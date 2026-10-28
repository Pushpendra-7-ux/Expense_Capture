"""Initial schema — all tables, enums, indexes, constraints.

Revision ID: 001_initial_schema
Revises: None
Create Date: 2024-10-28

This is a MANUAL migration that creates the full OPE schema:
  - 4 PostgreSQL ENUM types
  - 5 tables: users, expenses, expense_attachments, extraction_cache, rate_limits
  - All indexes and constraints
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID, TIMESTAMP

# ---------------------------------------------------------------------------
# Revision identifiers
# ---------------------------------------------------------------------------
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Enum definitions (to keep upgrade/downgrade symmetric)
# ---------------------------------------------------------------------------
CATEGORY_ENUM_VALUES = (
    "cab_local_transport",
    "travel",
    "client_meals_entertainment",
    "team_meals",
    "communication_data",
    "office_supplies",
    "other",
)

RECEIPT_TYPE_ENUM_VALUES = (
    "bill_photo",
    "payment_screenshot",
    "none",
)

EXTRACTION_STATUS_ENUM_VALUES = (
    "ok",
    "partial",
    "failed",
    "manual",
)

ATTACHMENT_KIND_ENUM_VALUES = (
    "bill",
    "payment_screenshot",
    "supporting",
)


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Create PostgreSQL ENUM types
    # ------------------------------------------------------------------
    category_enum = sa.Enum(
        *CATEGORY_ENUM_VALUES, name="category_enum", create_type=True
    )
    category_enum.create(op.get_bind(), checkfirst=True)

    receipt_type_enum = sa.Enum(
        *RECEIPT_TYPE_ENUM_VALUES, name="receipt_type_enum", create_type=True
    )
    receipt_type_enum.create(op.get_bind(), checkfirst=True)

    extraction_status_enum = sa.Enum(
        *EXTRACTION_STATUS_ENUM_VALUES, name="extraction_status_enum", create_type=True
    )
    extraction_status_enum.create(op.get_bind(), checkfirst=True)

    attachment_kind_enum = sa.Enum(
        *ATTACHMENT_KIND_ENUM_VALUES, name="attachment_kind_enum", create_type=True
    )
    attachment_kind_enum.create(op.get_bind(), checkfirst=True)

    # ------------------------------------------------------------------
    # 2. users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("role", sa.Text, nullable=True),
    )

    # ------------------------------------------------------------------
    # 3. expenses
    # ------------------------------------------------------------------
    op.create_table(
        "expenses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("reference_id", sa.String(20), nullable=False),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Money — integer paise, NEVER floats
        sa.Column("amount_minor", sa.BigInteger, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("expense_date", sa.Date, nullable=False),
        sa.Column("merchant", sa.String(300), nullable=True),
        sa.Column(
            "category",
            sa.Enum(*CATEGORY_ENUM_VALUES, name="category_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column(
            "receipt_type",
            sa.Enum(*RECEIPT_TYPE_ENUM_VALUES, name="receipt_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("txn_ref", sa.String(200), nullable=True),
        sa.Column("invoice_no", sa.String(200), nullable=True),
        sa.Column("tax_amount_minor", sa.BigInteger, nullable=True),
        # Extraction metadata
        sa.Column(
            "extraction_status",
            sa.Enum(
                *EXTRACTION_STATUS_ENUM_VALUES,
                name="extraction_status_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("extraction_json", JSONB, nullable=True),
        sa.Column("extracted_amount_minor", sa.BigInteger, nullable=True),
        sa.Column("extracted_date", sa.Date, nullable=True),
        sa.Column("extracted_merchant", sa.String(300), nullable=True),
        sa.Column(
            "edited_fields",
            sa.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "possible_duplicate",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
        # Idempotency
        sa.Column("idempotency_key", sa.String(200), nullable=False),
        sa.Column(
            "created_at",
            TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Indexes on expenses
    op.create_index(
        "ix_expenses_reference_id", "expenses", ["reference_id"], unique=True
    )
    op.create_index("ix_expenses_user_id", "expenses", ["user_id"])
    op.create_index(
        "ix_expenses_idempotency_key", "expenses", ["idempotency_key"], unique=True
    )

    # ------------------------------------------------------------------
    # 4. expense_attachments
    # ------------------------------------------------------------------
    op.create_table(
        "expense_attachments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "expense_id",
            UUID(as_uuid=True),
            sa.ForeignKey("expenses.id", ondelete="CASCADE"),
            nullable=True,  # null until linked to a submitted expense
        ),
        sa.Column("file_bytes", sa.LargeBinary, nullable=False),
        sa.Column("filename", sa.String(255), nullable=True),
        sa.Column("mime", sa.String(50), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                *ATTACHMENT_KIND_ENUM_VALUES,
                name="attachment_kind_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')",
            name="ck_attachment_mime",
        ),
    )

    # Indexes on expense_attachments
    op.create_index(
        "ix_expense_attachments_sha256", "expense_attachments", ["sha256"]
    )
    op.create_index(
        "ix_expense_attachments_expense_id", "expense_attachments", ["expense_id"]
    )

    # ------------------------------------------------------------------
    # 5. extraction_cache
    # ------------------------------------------------------------------
    op.create_table(
        "extraction_cache",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(200), nullable=False, unique=True),
        sa.Column("result_json", JSONB, nullable=False),
        sa.Column(
            "created_at",
            TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Index on extraction_cache.key
    op.create_index(
        "ix_extraction_cache_key", "extraction_cache", ["key"], unique=True
    )

    # ------------------------------------------------------------------
    # 6. rate_limits
    # ------------------------------------------------------------------
    op.create_table(
        "rate_limits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_ip", sa.String(45), nullable=False),
        sa.Column("window_start", TIMESTAMP(timezone=True), nullable=False),
        sa.Column("count", sa.Integer, nullable=False, server_default="0"),
    )

    # Index on rate_limits.client_ip
    op.create_index("ix_rate_limits_client_ip", "rate_limits", ["client_ip"])
    op.create_index(
        "ix_rate_limits_client_ip_window",
        "rate_limits",
        ["client_ip", "window_start"],
        unique=True,
    )


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_table("rate_limits")
    op.drop_table("extraction_cache")
    op.drop_table("expense_attachments")
    op.drop_table("expenses")
    op.drop_table("users")

    # Drop enum types
    sa.Enum(name="attachment_kind_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="extraction_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="receipt_type_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="category_enum").drop(op.get_bind(), checkfirst=True)
