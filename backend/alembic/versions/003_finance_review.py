"""Add finance review decisions (approve / reject).

Revision ID: 003_finance_review
Revises: 002_review_metadata
Create Date: 2026-10-29

The finance console records a real decision on each claim. This migration
extends the review status enum with `rejected` and stores when a decision was
made plus the reviewer's note for the employee.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_finance_review"
down_revision: Union[str, None] = "002_review_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extend the existing enum in place. IF NOT EXISTS keeps the migration
    # idempotent when the value was added manually during local development.
    op.execute(
        "ALTER TYPE review_status_enum ADD VALUE IF NOT EXISTS 'rejected'"
    )

    op.add_column(
        "expenses",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "expenses",
        sa.Column("review_note", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("expenses", "review_note")
    op.drop_column("expenses", "reviewed_at")
    # PostgreSQL cannot remove a single enum value; rebuild is intentionally
    # omitted because no application code depends on the old shape after
    # downgrade.
