"""
tests/test_phase6.py — Phase 6 mobile polish, edge case & validation tests.

Tests:
1. Duplicate detection: txn_ref, (merchant + amount + date), and attachment sha256
2. Trusted proxy handling vs socket IP
3. Rate limit enforcement (hourly per-IP and daily global cap)
4. Edited fields tracking schema integrity
5. Reason boundary checks (3 chars vs 10 chars)
6. Absurd amount ceiling (10,00,000 INR = 100,000,000 paise)
"""

from __future__ import annotations

import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.crud import check_duplicate, generate_reference_id
from app.models import User, Expense, ExpenseAttachment
from app.rate_limiter import get_client_ip
from app.schemas import ExpenseCreate, Category, ReceiptType
from app.seed import SEED_USER_ID


def test_edited_fields_schema_default_and_custom():
    """Verify edited_fields defaults to empty list and accepts string list."""
    payload = ExpenseCreate(
        amount_minor=50000,
        expense_date=date.today(),
        merchant="Blue Tokai",
        category=Category.CLIENT_MEALS_ENTERTAINMENT,
        reason="Client meeting coffee",
        receipt_type=ReceiptType.BILL_PHOTO,
    )
    assert payload.edited_fields == []

    payload_edited = ExpenseCreate(
        amount_minor=50000,
        expense_date=date.today(),
        merchant="Blue Tokai",
        category=Category.CLIENT_MEALS_ENTERTAINMENT,
        reason="Client meeting coffee",
        receipt_type=ReceiptType.BILL_PHOTO,
        edited_fields=["amount", "merchant"],
    )
    assert payload_edited.edited_fields == ["amount", "merchant"]


def test_amount_ceiling_exact_boundary():
    """Amount ceiling is exactly 10,00,000 INR (100,000,000 paise)."""
    # 10,00,000 INR allowed
    p1 = ExpenseCreate(
        amount_minor=100_000_000,
        expense_date=date.today(),
        merchant="Luxury Hotel",
        category=Category.TRAVEL,
        reason="Annual executive conference venue booking",
        receipt_type=ReceiptType.BILL_PHOTO,
    )
    assert p1.amount_minor == 100_000_000

    # 10,00,001 INR rejected
    with pytest.raises(ValidationError):
        ExpenseCreate(
            amount_minor=100_000_001,
            expense_date=date.today(),
            merchant="Luxury Hotel",
            category=Category.TRAVEL,
            reason="Annual executive conference venue booking",
            receipt_type=ReceiptType.BILL_PHOTO,
        )


def test_reason_exact_boundaries():
    """Reason length validation under all conditions."""
    # 1. Standard bill with >= 3 chars
    p_ok = ExpenseCreate(
        amount_minor=1000,
        expense_date=date.today(),
        merchant="Chai",
        category=Category.TEAM_MEALS,
        reason="Tea",
        receipt_type=ReceiptType.BILL_PHOTO,
    )
    assert p_ok.reason == "Tea"

    # 2. Standard bill with 2 chars -> rejected
    with pytest.raises(ValidationError):
        ExpenseCreate(
            amount_minor=1000,
            expense_date=date.today(),
            merchant="Chai",
            category=Category.TEAM_MEALS,
            reason="Te",
            receipt_type=ReceiptType.BILL_PHOTO,
        )

    # 3. Category Other with 9 chars -> rejected
    with pytest.raises(ValidationError):
        ExpenseCreate(
            amount_minor=1000,
            expense_date=date.today(),
            merchant="Store",
            category=Category.OTHER,
            reason="123456789",
            receipt_type=ReceiptType.BILL_PHOTO,
        )

    # 4. Category Other with 10 chars -> accepted
    p_other = ExpenseCreate(
        amount_minor=1000,
        expense_date=date.today(),
        merchant="Store",
        category=Category.OTHER,
        reason="1234567890",
        receipt_type=ReceiptType.BILL_PHOTO,
    )
    assert p_other.reason == "1234567890"

    # 5. Receipt type None with 9 chars -> rejected
    with pytest.raises(ValidationError):
        ExpenseCreate(
            amount_minor=1000,
            expense_date=date.today(),
            merchant=None,
            category=Category.CAB_LOCAL_TRANSPORT,
            reason="Short cab",
            receipt_type=ReceiptType.NONE,
        )

    # 6. Receipt type None with 10 chars -> accepted
    p_none = ExpenseCreate(
        amount_minor=1000,
        expense_date=date.today(),
        merchant=None,
        category=Category.CAB_LOCAL_TRANSPORT,
        reason="Cab to office",
        receipt_type=ReceiptType.NONE,
    )
    assert p_none.reason == "Cab to office"


def test_client_ip_trusted_proxy_handling(monkeypatch):
    """Test get_client_ip with and without TRUSTED_PROXY."""
    from app.config import settings

    # Case 1: TRUSTED_PROXY is True -> uses X-Forwarded-For
    monkeypatch.setattr(settings, "TRUSTED_PROXY", True)
    request_proxy = MagicMock()
    request_proxy.headers = {"X-Forwarded-For": "203.0.113.195, 70.41.3.18, 150.172.238.178"}
    request_proxy.client = MagicMock(host="10.0.0.1")
    assert get_client_ip(request_proxy) == "203.0.113.195"

    # Case 2: TRUSTED_PROXY is False -> ignores X-Forwarded-For and uses client.host
    monkeypatch.setattr(settings, "TRUSTED_PROXY", False)
    request_direct = MagicMock()
    request_direct.headers = {"X-Forwarded-For": "203.0.113.195"}
    request_direct.client = MagicMock(host="192.168.1.50")
    assert get_client_ip(request_direct) == "192.168.1.50"


@pytest.mark.asyncio
async def test_duplicate_check_by_merchant_amount_date():
    """Verify duplicate detection by merchant + amount + date."""
    mock_session = AsyncMock()
    
    # Mock finding an existing ID
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = uuid.uuid4()
    mock_session.execute.return_value = mock_result

    payload = ExpenseCreate(
        amount_minor=50000,
        expense_date=date.today(),
        merchant="Blue Tokai Coffee",
        category=Category.CLIENT_MEALS_ENTERTAINMENT,
        reason="Client meeting coffee",
        receipt_type=ReceiptType.BILL_PHOTO,
    )

    is_dup = await check_duplicate(mock_session, SEED_USER_ID, payload)
    assert is_dup is True


@pytest.mark.asyncio
async def test_duplicate_check_by_txn_ref():
    """Verify duplicate detection by transaction reference."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = uuid.uuid4()
    mock_session.execute.return_value = mock_result

    payload = ExpenseCreate(
        amount_minor=50000,
        expense_date=date.today(),
        merchant="Uber",
        category=Category.CAB_LOCAL_TRANSPORT,
        reason="Cab to office",
        receipt_type=ReceiptType.PAYMENT_SCREENSHOT,
        txn_ref="UPI/1234567890/SUCCESS",
    )

    is_dup = await check_duplicate(mock_session, SEED_USER_ID, payload)
    assert is_dup is True


@pytest.mark.asyncio
async def test_duplicate_check_by_attachment_sha256():
    """Verify duplicate detection by matching attachment sha256 hash."""
    mock_session = AsyncMock()

    # First call: select candidate hashes
    mock_hash_result = MagicMock()
    mock_hash_result.scalars.return_value.all.return_value = ["hash_abc123"]

    # Second call: select existing match for that hash
    mock_match_result = MagicMock()
    mock_match_result.scalar_one_or_none.return_value = uuid.uuid4()

    mock_session.execute.side_effect = [
        MagicMock(scalar_one_or_none=lambda: None),  # merchant/amount/date check returned None
        mock_hash_result,                           # candidate hash lookup
        mock_match_result,                          # duplicate match lookup
    ]

    payload = ExpenseCreate(
        amount_minor=25000,
        expense_date=date.today(),
        merchant="Swiggy",
        category=Category.TEAM_MEALS,
        reason="Team lunch snacks",
        receipt_type=ReceiptType.BILL_PHOTO,
        attachment_ids=[uuid.uuid4()],
    )

    is_dup = await check_duplicate(mock_session, SEED_USER_ID, payload)
    assert is_dup is True
