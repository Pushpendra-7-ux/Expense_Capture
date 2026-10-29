"""
app/schemas.py — Pydantic v2 schemas for Expense Capture (OPE).

Enforces:
- Amount in integer paise (BigInteger, strictly positive, <= 1,000,000 INR).
- Date not in future.
- Reason: min 3 chars; min 10 chars when receipt_type == 'none' or category == 'other'.
- Merchant required unless receipt_type == 'none'.
- Exactly 7 categories.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
import uuid
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class Category(str, Enum):
    CAB_LOCAL_TRANSPORT = "cab_local_transport"
    TRAVEL = "travel"
    CLIENT_MEALS_ENTERTAINMENT = "client_meals_entertainment"
    TEAM_MEALS = "team_meals"
    COMMUNICATION_DATA = "communication_data"
    OFFICE_SUPPLIES = "office_supplies"
    OTHER = "other"


CATEGORY_LABELS: dict[Category, str] = {
    Category.CAB_LOCAL_TRANSPORT: "Travel & Ground Transit",
    Category.TRAVEL: "Flights & Hotels",
    Category.CLIENT_MEALS_ENTERTAINMENT: "Client Entertainment",
    Category.TEAM_MEALS: "Meals & Dining",
    Category.COMMUNICATION_DATA: "Comms & Data",
    Category.OFFICE_SUPPLIES: "Office & Supplies",
    Category.OTHER: "Other",
}


class ReviewStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReviewDecisionAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"


class ReceiptType(str, Enum):
    BILL_PHOTO = "bill_photo"
    PAYMENT_SCREENSHOT = "payment_screenshot"
    NONE = "none"


class ExtractionStatus(str, Enum):
    OK = "ok"
    PARTIAL = "partial"
    FAILED = "failed"
    MANUAL = "manual"


# ---------------------------------------------------------------------------
# Helper: Decimal rupees to integer paise
# ---------------------------------------------------------------------------
MAX_AMOUNT_PAISE = 100_000_000  # 1,000,000 INR = ₹10 Lakhs


def rupees_to_paise(rupees: Decimal | float | int | str) -> int:
    """Safely convert rupees to integer paise using Decimal to avoid float errors."""
    d = Decimal(str(rupees)).quantize(Decimal("0.01"))
    paise = int(d * 100)
    return paise


# ---------------------------------------------------------------------------
# Expense Schemas
# ---------------------------------------------------------------------------
class ExpenseCreate(BaseModel):
    """Payload for submitting a new expense."""

    amount_minor: int = Field(
        ...,
        gt=0,
        le=MAX_AMOUNT_PAISE,
        description="Amount in paise (1/100 INR). Must be > 0 and <= ₹10,00,000.",
    )
    currency: str = Field(default="INR", max_length=3)
    expense_date: date = Field(..., description="Date of the expense (YYYY-MM-DD).")
    merchant: str | None = Field(
        default=None,
        max_length=300,
        description="Merchant/payee name. Required unless receipt_type is none.",
    )
    category: Category = Field(..., description="One of the 7 predefined categories.")
    reason: str = Field(
        ...,
        description="Business justification / purpose.",
    )
    receipt_type: ReceiptType = Field(
        default=ReceiptType.NONE,
        description="bill_photo | payment_screenshot | none",
    )
    txn_ref: str | None = Field(default=None, max_length=200)
    invoice_no: str | None = Field(default=None, max_length=200)
    tax_amount_minor: int | None = Field(default=None, ge=0)

    # Extraction metadata
    extraction_status: ExtractionStatus = Field(default=ExtractionStatus.MANUAL)
    extraction_json: dict[str, Any] | None = None
    extracted_amount_minor: int | None = None
    extracted_date: date | None = None
    extracted_merchant: str | None = None
    edited_fields: list[str] = Field(default_factory=list)
    attachment_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("expense_date")
    @classmethod
    def validate_date_not_in_future(cls, v: date) -> date:
        today = date.today()
        if v > today:
            raise ValueError(f"Expense date cannot be in the future (given: {v}, today: {today})")
        return v

    @model_validator(mode="after")
    def validate_rules(self) -> ExpenseCreate:
        # 1. Merchant required unless receipt_type is none
        if self.receipt_type != ReceiptType.NONE:
            if not self.merchant or not self.merchant.strip():
                raise ValueError("Merchant is required when a bill photo or payment screenshot is provided.")

        # 2. Reason length requirements:
        # min 3 chars normally; min 10 chars when receipt_type is none OR category is Other
        reason_clean = self.reason.strip() if self.reason else ""
        if len(reason_clean) < 3:
            raise ValueError("Reason must be at least 3 characters.")

        if self.receipt_type == ReceiptType.NONE or self.category == Category.OTHER:
            if len(reason_clean) < 10:
                condition = "receipt_type is 'none'" if self.receipt_type == ReceiptType.NONE else "category is 'Other'"
                raise ValueError(
                    f"Reason must be at least 10 characters when {condition} (currently {len(reason_clean)})."
                )

        return self


class AttachmentInfo(BaseModel):
    id: uuid.UUID
    mime: str
    filename: str | None = None
    kind: str

    model_config = {"from_attributes": True}


class ExpenseResponse(BaseModel):
    """Response returned when fetching or submitting an expense."""

    id: uuid.UUID
    reference_id: str
    user_id: uuid.UUID
    amount_minor: int
    currency: str
    expense_date: date
    merchant: str | None = None
    category: Category
    category_label: str = ""
    reason: str
    receipt_type: ReceiptType
    txn_ref: str | None = None
    invoice_no: str | None = None
    tax_amount_minor: int | None = None
    extraction_status: ExtractionStatus
    review_status: ReviewStatus = ReviewStatus.SUBMITTED
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    review_note: str | None = None
    billable: bool = True
    possible_duplicate: bool = False
    extraction_json: dict[str, Any] | None = None
    created_at: datetime
    attachment_count: int = 0
    attachments: list[AttachmentInfo] = Field(default_factory=list)

    model_config = {"from_attributes": True}

    @field_validator("review_status", mode="before")
    @classmethod
    def default_review_status(cls, value: Any) -> Any:
        """Older rows and in-flight objects may not have a review status yet."""
        return value or ReviewStatus.SUBMITTED

    @field_validator("billable", mode="before")
    @classmethod
    def default_billable(cls, value: Any) -> Any:
        return True if value is None else value

    @model_validator(mode="after")
    def populate_label(self) -> ExpenseResponse:
        if self.category in CATEGORY_LABELS:
            self.category_label = CATEGORY_LABELS[self.category]
        return self


class ReviewDecision(BaseModel):
    """Finance team decision on a submitted claim."""

    action: ReviewDecisionAction
    note: str | None = Field(default=None, max_length=500)
    reviewer: str = Field(default="Finance Team • OPE", max_length=200)


class ExpenseListResponse(BaseModel):
    """Paginated list of expenses."""

    items: list[ExpenseResponse]
    next_cursor: str | None = None
    has_more: bool = False
    total_count: int = 0
