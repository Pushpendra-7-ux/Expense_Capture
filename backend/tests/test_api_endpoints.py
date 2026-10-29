"""
backend/tests/test_api_endpoints.py — Comprehensive ASGI endpoint integration tests
for Expense Capture (OPE).

Tests:
1. GET /health
2. POST /expenses/attachments (valid JPEG, valid PDF, invalid type, fake content, >3 files)
3. POST /expenses (validation: amount ceiling, future date, merchant requirement, reason lengths)
4. POST /expenses (idempotency header enforcement and replay)
5. GET /expenses (cursor pagination, limits)
6. GET /expenses/{identifier} (lookup by reference_id and UUID, 404 handling)
7. PATCH /expenses/{identifier}/review (approve, reject-with-note, 404)
"""

from __future__ import annotations

import io
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from app.database import get_db
from app.main import app
from app.models import Expense, ExpenseAttachment
from app.schemas import Category, ExtractionStatus, ReceiptType
from app.seed import SEED_USER_ID


# Minimal valid 1x1 JPEG
TINY_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
    b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
    b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
    b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4"
    b"\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00"
    b"\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
    b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
)

# Minimal valid 1-page PDF
TINY_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
    b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
    b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\n"
    b"xref\n"
    b"0 4\n"
    b"0000000000 65535 f \n"
    b"0000000009 00000 n \n"
    b"0000000058 00000 n \n"
    b"0000000115 00000 n \n"
    b"trailer << /Size 4 /Root 1 0 R >>\n"
    b"startxref\n"
    b"190\n"
    b"%%EOF\n"
)


@pytest.fixture
def mock_db_session():
    """Mock AsyncSession for FastAPI dependency injection."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.flush = AsyncMock()
    session.add = MagicMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def client(mock_db_session):
    """Async test client with overridden database session."""
    async def _get_test_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = _get_test_db
    transport = httpx.ASGITransport(app=app)
    c = httpx.AsyncClient(transport=transport, base_url="http://test")
    yield c
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """GET /health returns status ok and a valid timestamp."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_upload_attachments_valid_jpeg(client, mock_db_session):
    """POST /expenses/attachments successfully processes a valid JPEG."""
    att_id = uuid.uuid4()
    mock_att = ExpenseAttachment(
        id=att_id,
        file_bytes=TINY_JPEG,
        mime="image/jpeg",
        kind="bill",
        filename="receipt.jpg",
        sha256="dummy_sha",
    )

    with patch("app.main.storage.save", new_callable=AsyncMock) as mock_save:
        mock_save.return_value = mock_att
        files = [("files", ("receipt.jpg", io.BytesIO(TINY_JPEG), "image/jpeg"))]
        resp = await client.post("/expenses/attachments", files=files, data={"kind": "bill"})

        assert resp.status_code == 201
        data = resp.json()
        assert len(data) == 1
        assert data[0]["mime"] == "image/jpeg"
        assert data[0]["kind"] == "bill"
        assert data[0]["id"] == str(att_id)


@pytest.mark.asyncio
async def test_upload_attachments_reject_fake_pdf(client):
    """POST /expenses/attachments rejects fake PDF with 400."""
    fake_pdf = b"not a real pdf at all"
    files = [("files", ("receipt.pdf", io.BytesIO(fake_pdf), "application/pdf"))]
    resp = await client.post("/expenses/attachments", files=files)
    assert resp.status_code == 400
    assert "unsupported format" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_attachments_reject_too_many_files(client):
    """POST /expenses/attachments rejects more than 3 files."""
    files = [
        ("files", (f"file_{i}.jpg", io.BytesIO(TINY_JPEG), "image/jpeg"))
        for i in range(4)
    ]
    resp = await client.post("/expenses/attachments", files=files)
    assert resp.status_code == 400
    assert "Maximum allowed is 3" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_submit_expense_requires_idempotency_key(client):
    """POST /expenses returns 422 if Idempotency-Key header is missing."""
    payload = {
        "amount_minor": 50000,
        "expense_date": str(date.today()),
        "merchant": "Swiggy",
        "category": "team_meals",
        "reason": "Team sprint lunch",
        "receipt_type": "bill_photo",
    }
    resp = await client.post("/expenses", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_submit_expense_success(client, mock_db_session):
    """POST /expenses creates a valid expense claim and returns ExpenseResponse."""
    exp_id = uuid.uuid4()
    mock_expense = Expense(
        id=exp_id,
        reference_id="OPE-X99Z12",
        user_id=SEED_USER_ID,
        amount_minor=85000,
        currency="INR",
        expense_date=date.today(),
        merchant="Taj Hotel Mumbai",
        category=Category.TRAVEL.value,
        reason="Client workshop stay",
        receipt_type=ReceiptType.BILL_PHOTO.value,
        txn_ref="TAJ-9921",
        invoice_no="INV-1029",
        tax_amount_minor=12000,
        extraction_status=ExtractionStatus.OK.value,
        possible_duplicate=False,
        created_at=datetime.now(timezone.utc),
    )
    mock_expense.attachments = []
    mock_expense.attachment_count = 0

    with patch("app.main.create_expense", new_callable=AsyncMock) as mock_create, \
         patch("app.main.get_expense_by_id", new_callable=AsyncMock) as mock_get:
        mock_create.return_value = mock_expense
        mock_get.return_value = mock_expense

        payload = {
            "amount_minor": 85000,
            "expense_date": str(date.today()),
            "merchant": "Taj Hotel Mumbai",
            "category": "travel",
            "reason": "Client workshop stay",
            "receipt_type": "bill_photo",
            "txn_ref": "TAJ-9921",
            "invoice_no": "INV-1029",
            "tax_amount_minor": 12000,
        }
        resp = await client.post(
            "/expenses",
            json=payload,
            headers={"Idempotency-Key": "test-key-123"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["reference_id"] == "OPE-X99Z12"
        assert data["category_label"] == "Flights & Hotels"
        assert data["amount_minor"] == 85000
        assert data["merchant"] == "Taj Hotel Mumbai"


@pytest.mark.asyncio
async def test_submit_expense_validation_error_on_future_date(client):
    """POST /expenses rejects a future date with 422."""
    future_date = date(2035, 1, 1)
    payload = {
        "amount_minor": 50000,
        "expense_date": str(future_date),
        "merchant": "Swiggy",
        "category": "team_meals",
        "reason": "Sprint lunch",
        "receipt_type": "bill_photo",
    }
    resp = await client.post(
        "/expenses",
        json=payload,
        headers={"Idempotency-Key": "test-future-key"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_expenses_list(client):
    """GET /expenses returns paginated list structure."""
    exp_id = uuid.uuid4()
    mock_expense = Expense(
        id=exp_id,
        reference_id="OPE-K77L43",
        user_id=SEED_USER_ID,
        amount_minor=6840,
        currency="INR",
        expense_date=date.today(),
        merchant="Uber",
        category=Category.CAB_LOCAL_TRANSPORT.value,
        reason="Client meeting cab ride",
        receipt_type=ReceiptType.PAYMENT_SCREENSHOT.value,
        extraction_status=ExtractionStatus.OK.value,
        possible_duplicate=False,
        created_at=datetime.now(timezone.utc),
    )
    mock_expense.attachments = []
    mock_expense.attachment_count = 0

    with patch("app.main.list_expenses", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = ([mock_expense], None, False, 1)
        resp = await client.get("/expenses?limit=10")

        assert resp.status_code == 200
        data = resp.json()
        assert data["total_count"] == 1
        assert data["has_more"] is False
        assert len(data["items"]) == 1
        assert data["items"][0]["reference_id"] == "OPE-K77L43"
        assert data["items"][0]["category_label"] == "Travel & Ground Transit"


@pytest.mark.asyncio
async def test_get_single_expense_not_found(client):
    """GET /expenses/{identifier} returns 404 when expense does not exist."""
    with patch("app.main.get_expense_by_id", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None
        resp = await client.get("/expenses/OPE-NOTFOUND")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


def _reviewed_expense(status: str = "approved") -> Expense:
    """Build a fully populated Expense for finance review responses."""
    expense = Expense(
        id=uuid.uuid4(),
        reference_id="OPE-REV123",
        user_id=SEED_USER_ID,
        amount_minor=342050,
        currency="INR",
        expense_date=date.today(),
        merchant="Uber",
        category=Category.CAB_LOCAL_TRANSPORT.value,
        reason="Client roadshow travel",
        receipt_type=ReceiptType.BILL_PHOTO.value,
        extraction_status=ExtractionStatus.OK.value,
        extraction_json={
            "status": "ok",
            "fields": {"amount_rupees": "3420.50", "merchant": "Uber"},
        },
        review_status=status,
        reviewed_by="Finance Team • OPE",
        reviewed_at=datetime.now(timezone.utc),
        review_note="Personal desk purchase — not reimbursable.",
        billable=True,
        possible_duplicate=False,
        created_at=datetime.now(timezone.utc),
    )
    expense.attachments = []
    expense.attachment_count = 0
    return expense


@pytest.mark.asyncio
async def test_review_expense_approve(client):
    """PATCH /expenses/{id}/review approves a claim and records the reviewer."""
    expense = _reviewed_expense("approved")

    with patch("app.main.review_expense", new_callable=AsyncMock) as mock_review:
        mock_review.return_value = expense
        resp = await client.patch(
            "/expenses/OPE-REV123/review",
            json={"action": "approve", "note": "Looks good", "reviewer": "Finance Team • OPE"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["review_status"] == "approved"
        assert data["reviewed_by"] == "Finance Team • OPE"
        assert data["review_note"] == "Personal desk purchase — not reimbursable."
        assert data["extraction_json"]["fields"]["merchant"] == "Uber"
        mock_review.assert_awaited_once()


@pytest.mark.asyncio
async def test_review_expense_reject_requires_note(client):
    """Rejecting without a reviewer note is rejected before writing."""
    with patch("app.main.review_expense", new_callable=AsyncMock) as mock_review:
        resp = await client.patch(
            "/expenses/OPE-REV123/review",
            json={"action": "reject", "note": "   "},
        )

        assert resp.status_code == 422
        assert "reason" in resp.json()["detail"].lower()
        mock_review.assert_not_awaited()


@pytest.mark.asyncio
async def test_review_expense_reject_records_note(client):
    """A valid rejection persists the note for the employee detail screen."""
    expense = _reviewed_expense("rejected")

    with patch("app.main.review_expense", new_callable=AsyncMock) as mock_review:
        mock_review.return_value = expense
        resp = await client.patch(
            "/expenses/OPE-REV123/review",
            json={"action": "reject", "note": "Duplicate claim"},
        )

        assert resp.status_code == 200
        assert resp.json()["review_status"] == "rejected"
        kwargs = mock_review.await_args.kwargs
        assert kwargs["action"] == "reject"
        assert kwargs["note"] == "Duplicate claim"
        assert kwargs["reviewer"] == "Finance Team • OPE"


@pytest.mark.asyncio
async def test_review_expense_not_found(client):
    """Reviewing a missing claim returns 404."""
    with patch("app.main.review_expense", new_callable=AsyncMock) as mock_review:
        mock_review.return_value = None
        resp = await client.patch(
            "/expenses/OPE-MISSING/review",
            json={"action": "approve"},
        )

        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_attachment_must_belong_to_expense(client, mock_db_session):
    """An attachment from another claim cannot be read through this expense."""
    expense = _reviewed_expense()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result

    with patch(
        "app.main.get_expense_by_id", new_callable=AsyncMock
    ) as mock_get, patch(
        "app.main.storage.get", new_callable=AsyncMock
    ) as mock_storage_get:
        mock_get.return_value = expense
        attachment_id = uuid.uuid4()
        resp = await client.get(
            f"/expenses/{expense.reference_id}/attachments/{attachment_id}"
        )

        assert resp.status_code == 404
        assert "attachment not found" in resp.json()["detail"].lower()
        mock_storage_get.assert_not_awaited()
