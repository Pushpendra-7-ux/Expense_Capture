"""
app/models.py — SQLAlchemy 2.x ORM models for Expense Capture (OPE).

Design rules
~~~~~~~~~~~~
* Money is stored as **integer paise** (BigInteger) — NEVER floats.
* Primary keys are UUID v4.
* All timestamps are UTC with timezone info.
* Category / receipt_type / extraction_status / attachment kind use
  **native PostgreSQL ENUM** types for data integrity.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# ---------------------------------------------------------------------------
# Native PostgreSQL ENUM types
# ---------------------------------------------------------------------------

CategoryEnum = ENUM(
    "cab_local_transport",
    "travel",
    "client_meals_entertainment",
    "team_meals",
    "communication_data",
    "office_supplies",
    "other",
    name="category_enum",
    create_type=False,  # created in migration
)

ReceiptTypeEnum = ENUM(
    "bill_photo",
    "payment_screenshot",
    "none",
    name="receipt_type_enum",
    create_type=False,
)

ExtractionStatusEnum = ENUM(
    "ok",
    "partial",
    "failed",
    "manual",
    name="extraction_status_enum",
    create_type=False,
)

ReviewStatusEnum = ENUM(
    "submitted",
    "under_review",
    "approved",
    "rejected",
    name="review_status_enum",
    create_type=False,
)

AttachmentKindEnum = ENUM(
    "bill",
    "payment_screenshot",
    "supporting",
    name="attachment_kind_enum",
    create_type=False,
)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class User(Base):
    """A person who can submit expenses."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    expenses: Mapped[list["Expense"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.name!r}>"


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------
class Expense(Base):
    """A single expense claim submitted by a user.

    `amount_minor` is stored in **paise** (1/100 of INR).
    """

    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_reference_id", "reference_id", unique=True),
        Index("ix_expenses_user_id", "user_id"),
        Index("ix_expenses_idempotency_key", "idempotency_key", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reference_id: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # --- Money (paise, NEVER floats) ---
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")

    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    merchant: Mapped[str | None] = mapped_column(String(300), nullable=True)
    category: Mapped[str] = mapped_column(CategoryEnum, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    receipt_type: Mapped[str] = mapped_column(ReceiptTypeEnum, nullable=False)
    txn_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)
    invoice_no: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tax_amount_minor: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # --- Gemini extraction metadata ---
    extraction_status: Mapped[str] = mapped_column(
        ExtractionStatusEnum, nullable=False
    )
    review_status: Mapped[str] = mapped_column(
        ReviewStatusEnum,
        nullable=False,
        default="submitted",
        server_default="submitted",
    )
    reviewed_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    billable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    extraction_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    extracted_amount_minor: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )
    extracted_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    extracted_merchant: Mapped[str | None] = mapped_column(String(300), nullable=True)
    edited_fields: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default="{}"
    )
    possible_duplicate: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # --- Idempotency ---
    idempotency_key: Mapped[str] = mapped_column(
        String(200), unique=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="expenses")
    attachments: Mapped[list["ExpenseAttachment"]] = relationship(
        back_populates="expense", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Expense {self.reference_id} ₹{self.amount_minor / 100:.2f}>"


# ---------------------------------------------------------------------------
# Expense Attachments
# ---------------------------------------------------------------------------
class ExpenseAttachment(Base):
    """Binary file (receipt image / PDF) linked to an expense."""

    __tablename__ = "expense_attachments"
    __table_args__ = (
        CheckConstraint(
            "mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')",
            name="ck_attachment_mime",
        ),
        Index("ix_expense_attachments_sha256", "sha256"),
        Index("ix_expense_attachments_expense_id", "expense_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    expense_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expenses.id", ondelete="CASCADE"),
        nullable=True,  # null until the expense is submitted
    )
    file_bytes: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    mime: Mapped[str] = mapped_column(String(50), nullable=False)
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(AttachmentKindEnum, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    expense: Mapped["Expense | None"] = relationship(back_populates="attachments")

    def __repr__(self) -> str:
        return f"<Attachment {self.id} kind={self.kind}>"


# ---------------------------------------------------------------------------
# Extraction Cache
# ---------------------------------------------------------------------------
class ExtractionCache(Base):
    """Cache layer for Gemini extraction results keyed by content hash."""

    __tablename__ = "extraction_cache"
    __table_args__ = (
        Index("ix_extraction_cache_key", "key", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    key: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    result_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<ExtractionCache key={self.key!r}>"


# ---------------------------------------------------------------------------
# Rate Limits
# ---------------------------------------------------------------------------
class RateLimit(Base):
    """Per-IP rolling-window rate limit counter.

    A sentinel row with ``client_ip = '__global__'`` tracks the daily
    Gemini extraction cap across all users.
    """

    __tablename__ = "rate_limits"
    __table_args__ = (
        Index("ix_rate_limits_client_ip", "client_ip"),
        Index(
            "ix_rate_limits_client_ip_window",
            "client_ip",
            "window_start",
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_ip: Mapped[str] = mapped_column(String(45), nullable=False)
    window_start: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<RateLimit ip={self.client_ip} count={self.count}>"
