"""
tests/test_phase2.py — Unit tests for Phase 2: validation, paise conversion, reference IDs, and business logic.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
import pytest
from pydantic import ValidationError

from app.crud import generate_reference_id
from app.schemas import (
    Category,
    ExpenseCreate,
    ReceiptType,
    rupees_to_paise,
    MAX_AMOUNT_PAISE,
)


# ---------------------------------------------------------------------------
# 1. Paise Conversion Tests
# ---------------------------------------------------------------------------
def test_rupees_to_paise_exact() -> None:
    assert rupees_to_paise(68.40) == 6840
    assert rupees_to_paise("68.40") == 6840
    assert rupees_to_paise(Decimal("68.40")) == 6840
    assert rupees_to_paise(152) == 15200
    assert rupees_to_paise("8750.50") == 875050
    assert rupees_to_paise("0.05") == 5
    assert rupees_to_paise("1000000") == 100_000_000


def test_rupees_to_paise_rounding() -> None:
    # 3 decimal places rounds to 2 decimal places
    assert rupees_to_paise("68.404") == 6840
    assert rupees_to_paise("68.406") == 6841


# ---------------------------------------------------------------------------
# 2. Reference ID Generation Tests
# ---------------------------------------------------------------------------
def test_generate_reference_id_format() -> None:
    ref_id = generate_reference_id()
    assert ref_id.startswith("OPE-")
    assert len(ref_id) == 10  # "OPE-" (4) + 6 chars
    code = ref_id[4:]
    assert code.isalnum()
    assert code.isupper()


def test_generate_reference_id_uniqueness() -> None:
    ids = {generate_reference_id() for _ in range(100)}
    assert len(ids) == 100


# ---------------------------------------------------------------------------
# 3. Validation: Amount
# ---------------------------------------------------------------------------
def test_amount_positive_required() -> None:
    today = date.today()
    # Zero amount must fail
    with pytest.raises(ValidationError) as exc:
        ExpenseCreate(
            amount_minor=0,
            expense_date=today,
            category=Category.CAB_LOCAL_TRANSPORT,
            reason="Cab ride to client office",
            receipt_type=ReceiptType.NONE,
        )
    assert "Input should be greater than 0" in str(exc.value)

    # Negative amount must fail
    with pytest.raises(ValidationError):
        ExpenseCreate(
            amount_minor=-500,
            expense_date=today,
            category=Category.CAB_LOCAL_TRANSPORT,
            reason="Cab ride to client office",
            receipt_type=ReceiptType.NONE,
        )


def test_amount_ceiling_enforced() -> None:
    today = date.today()
    # Exactly max is allowed (1,000,000 INR = 100,000,000 paise)
    exp = ExpenseCreate(
        amount_minor=MAX_AMOUNT_PAISE,
        expense_date=today,
        category=Category.TRAVEL,
        reason="Annual overseas client conference flight",
        receipt_type=ReceiptType.NONE,
    )
    assert exp.amount_minor == 100_000_000

    # Above max must fail
    with pytest.raises(ValidationError) as exc:
        ExpenseCreate(
            amount_minor=MAX_AMOUNT_PAISE + 1,
            expense_date=today,
            category=Category.TRAVEL,
            reason="Over ceiling expense test",
            receipt_type=ReceiptType.NONE,
        )
    assert "Input should be less than or equal to 100000000" in str(exc.value)


# ---------------------------------------------------------------------------
# 4. Validation: Date (No Future Dates)
# ---------------------------------------------------------------------------
def test_future_date_rejected() -> None:
    tomorrow = date.today() + timedelta(days=1)
    with pytest.raises(ValidationError) as exc:
        ExpenseCreate(
            amount_minor=5000,
            expense_date=tomorrow,
            category=Category.CAB_LOCAL_TRANSPORT,
            reason="Tomorrow's taxi booking",
            receipt_type=ReceiptType.NONE,
        )
    assert "cannot be in the future" in str(exc.value)


def test_today_and_past_dates_allowed() -> None:
    today = date.today()
    yesterday = today - timedelta(days=1)
    last_year = today - timedelta(days=365)

    exp_today = ExpenseCreate(
        amount_minor=5000,
        expense_date=today,
        category=Category.CAB_LOCAL_TRANSPORT,
        reason="Today's taxi booking",
        receipt_type=ReceiptType.NONE,
    )
    assert exp_today.expense_date == today

    exp_yesterday = ExpenseCreate(
        amount_minor=5000,
        expense_date=yesterday,
        category=Category.CAB_LOCAL_TRANSPORT,
        reason="Yesterday's taxi booking",
        receipt_type=ReceiptType.NONE,
    )
    assert exp_yesterday.expense_date == yesterday

    exp_past = ExpenseCreate(
        amount_minor=5000,
        expense_date=last_year,
        category=Category.CAB_LOCAL_TRANSPORT,
        reason="Last year's taxi booking",
        receipt_type=ReceiptType.NONE,
    )
    assert exp_past.expense_date == last_year


# ---------------------------------------------------------------------------
# 5. Validation: Merchant
# ---------------------------------------------------------------------------
def test_merchant_required_for_bill_photo() -> None:
    today = date.today()
    # Missing merchant with bill_photo must fail
    with pytest.raises(ValidationError) as exc:
        ExpenseCreate(
            amount_minor=5000,
            expense_date=today,
            category=Category.CAB_LOCAL_TRANSPORT,
            reason="Taxi ride from airport",
            receipt_type=ReceiptType.BILL_PHOTO,
            merchant=None,
        )
    assert "Merchant is required" in str(exc.value)

    # Empty string merchant must fail
    with pytest.raises(ValidationError) as exc:
        ExpenseCreate(
            amount_minor=5000,
            expense_date=today,
            category=Category.CAB_LOCAL_TRANSPORT,
            reason="Taxi ride from airport",
            receipt_type=ReceiptType.BILL_PHOTO,
            merchant="   ",
        )
    assert "Merchant is required" in str(exc.value)


def test_merchant_optional_for_none_receipt_type() -> None:
    today = date.today()
    exp = ExpenseCreate(
        amount_minor=5000,
        expense_date=today,
        category=Category.CAB_LOCAL_TRANSPORT,
        reason="Auto-rickshaw cash fare with no bill",
        receipt_type=ReceiptType.NONE,
        merchant=None,
    )
    assert exp.merchant is None


# ---------------------------------------------------------------------------
# 6. Validation: Reason Length
# ---------------------------------------------------------------------------
def test_reason_minimum_length() -> None:
    today = date.today()
    # Normal bill: min 3 chars
    with pytest.raises(ValidationError) as exc:
        ExpenseCreate(
            amount_minor=5000,
            expense_date=today,
            category=Category.CAB_LOCAL_TRANSPORT,
            reason="Hi",
            receipt_type=ReceiptType.BILL_PHOTO,
            merchant="Uber",
        )
    assert "at least 3 characters" in str(exc.value)

    # 3 chars is accepted for normal bill
    exp = ExpenseCreate(
        amount_minor=5000,
        expense_date=today,
        category=Category.CAB_LOCAL_TRANSPORT,
        reason="Cab",
        receipt_type=ReceiptType.BILL_PHOTO,
        merchant="Uber",
    )
    assert exp.reason == "Cab"


def test_reason_min_10_chars_for_none_receipt() -> None:
    today = date.today()
    # Less than 10 chars for receipt_type=none must fail
    with pytest.raises(ValidationError) as exc:
        ExpenseCreate(
            amount_minor=5000,
            expense_date=today,
            category=Category.CAB_LOCAL_TRANSPORT,
            reason="Short des",  # 9 chars
            receipt_type=ReceiptType.NONE,
        )
    assert "at least 10 characters" in str(exc.value)

    # 10 chars accepted
    exp = ExpenseCreate(
        amount_minor=5000,
        expense_date=today,
        category=Category.CAB_LOCAL_TRANSPORT,
        reason="Cab to BKC",  # 10 chars
        receipt_type=ReceiptType.NONE,
    )
    assert exp.reason == "Cab to BKC"


def test_reason_min_10_chars_for_other_category() -> None:
    today = date.today()
    # Less than 10 chars for category=Other must fail
    with pytest.raises(ValidationError) as exc:
        ExpenseCreate(
            amount_minor=5000,
            expense_date=today,
            category=Category.OTHER,
            reason="Pencil",  # 6 chars
            receipt_type=ReceiptType.BILL_PHOTO,
            merchant="Staples",
        )
    assert "at least 10 characters when category is 'Other'" in str(exc.value)

    # 10 chars accepted
    exp = ExpenseCreate(
        amount_minor=5000,
        expense_date=today,
        category=Category.OTHER,
        reason="Stationery",  # 10 chars
        receipt_type=ReceiptType.BILL_PHOTO,
        merchant="Staples",
    )
    assert exp.reason == "Stationery"


# ---------------------------------------------------------------------------
# 7. Validation: Categories (Exactly 7)
# ---------------------------------------------------------------------------
def test_all_seven_categories_valid() -> None:
    today = date.today()
    for cat in Category:
        exp = ExpenseCreate(
            amount_minor=5000,
            expense_date=today,
            category=cat,
            reason="Valid category test with 10+ chars",
            receipt_type=ReceiptType.NONE,
        )
        assert exp.category == cat

    assert len(list(Category)) == 7
