"""Add display-only review metadata to expenses.

Revision ID: 002_review_metadata
Revises: 001_initial_schema
Create Date: 2026-10-29

The review metadata is intentionally read-only in the API. It gives the
employee a clear view of where a claim sits in the finance ledger without
introducing an approval workflow (explicitly out of scope for this build).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_review_metadata"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    review_status_enum = sa.Enum(
        "submitted",
        "under_review",
        "approved",
        name="review_status_enum",
        create_type=True,
    )
    review_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "expenses",
        sa.Column(
            "review_status",
            sa.Enum(
                "submitted",
                "under_review",
                "approved",
                name="review_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'submitted'"),
        ),
    )
    op.add_column(
        "expenses",
        sa.Column("reviewed_by", sa.String(200), nullable=True),
    )
    op.add_column(
        "expenses",
        sa.Column(
            "billable",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("expenses", "billable")
    op.drop_column("expenses", "reviewed_by")
    op.drop_column("expenses", "review_status")
    sa.Enum(name="review_status_enum").drop(op.get_bind(), checkfirst=True)
