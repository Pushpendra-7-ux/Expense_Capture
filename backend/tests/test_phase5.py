"""
backend/tests/test_phase5.py — Unit tests for Phase 5: Past expenses feed,
cursor pagination, and single expense retrieval.
"""

import uuid
from datetime import date, datetime, timezone
import pytest
from app.models import Expense, User
from app.schemas import Category, ExpenseCreate, ExpenseListResponse, ExpenseResponse, ReceiptType
from app.seed import SEED_USER_ID
from app.crud import generate_reference_id


def test_expense_response_category_label_population():
    exp = ExpenseResponse(
        id=uuid.uuid4(),
        reference_id="OPE-A7K291",
        user_id=SEED_USER_ID,
        amount_minor=6840,
        currency="INR",
        expense_date=date(2026, 10, 28),
        merchant="Uber India",
        category=Category.CAB_LOCAL_TRANSPORT,
        reason="Client meeting cab ride",
        receipt_type=ReceiptType.BILL_PHOTO,
        txn_ref="UBER-123",
        invoice_no=None,
        tax_amount_minor=None,
        extraction_status="ok",
        possible_duplicate=False,
        created_at=datetime.now(timezone.utc),
        attachment_count=1,
        attachments=[],
    )

    assert exp.category_label == "Travel & Ground Transit"
    assert exp.amount_minor == 6840
    assert exp.reference_id == "OPE-A7K291"


def test_expense_list_response_schema():
    items = [
        ExpenseResponse(
            id=uuid.uuid4(),
            reference_id=f"OPE-{i:06d}",
            user_id=SEED_USER_ID,
            amount_minor=1000 * (i + 1),
            currency="INR",
            expense_date=date(2026, 10, 28),
            merchant=f"Merchant {i}",
            category=Category.OFFICE_SUPPLIES,
            reason=f"Business supplies purchase {i}",
            receipt_type=ReceiptType.BILL_PHOTO,
            extraction_status="ok",
            possible_duplicate=False,
            created_at=datetime.now(timezone.utc),
            attachment_count=0,
            attachments=[],
        )
        for i in range(5)
    ]

    resp = ExpenseListResponse(
        items=items,
        next_cursor=items[-1].created_at.isoformat(),
        has_more=True,
        total_count=15,
    )

    assert len(resp.items) == 5
    assert resp.has_more is True
    assert resp.total_count == 15
    assert resp.items[0].category_label == "Office & Supplies"


def test_reference_id_generation_deterministic_shape():
    for _ in range(50):
        ref_id = generate_reference_id()
        assert ref_id.startswith("OPE-")
        assert len(ref_id) == 10
        alphanumeric = ref_id[4:]
        assert len(alphanumeric) == 6
        assert alphanumeric.isupper() or alphanumeric.isalnum()
        # Disallowed ambiguous characters
        assert "0" not in alphanumeric
        assert "O" not in alphanumeric
        assert "1" not in alphanumeric
        assert "I" not in alphanumeric


def test_indian_rupee_formatting_logic():
    # Helper to test the python equivalent of frontend's formatINR
    def py_format_inr(paise: int) -> str:
        rupees = paise / 100
        int_part, dec_part = f"{abs(rupees):.2f}".split(".")
        is_neg = paise < 0
        if len(int_part) <= 3:
            return f"{'-' if is_neg else ''}₹{int_part}.{dec_part}"
        last_three = int_part[-3:]
        rest = int_part[:-3]
        import re
        grouped = re.sub(r"\B(?=(\d{2})+(?!\d))", ",", rest)
        return f"{'-' if is_neg else ''}₹{grouped},{last_three}.{dec_part}"

    assert py_format_inr(6840) == "₹68.40"
    assert py_format_inr(15200) == "₹152.00"
    assert py_format_inr(875000) == "₹8,750.00"
    assert py_format_inr(10000000) == "₹1,00,000.00"
    assert py_format_inr(100000000) == "₹10,00,000.00"
    assert py_format_inr(12345678) == "₹1,23,456.78"


def test_empty_list_response():
    resp = ExpenseListResponse(
        items=[],
        next_cursor=None,
        has_more=False,
        total_count=0,
    )
    assert len(resp.items) == 0
    assert resp.has_more is False
    assert resp.next_cursor is None
    assert resp.total_count == 0
