"""
app/seed.py — Seed the database with a default user and sample expenses.

Called once on application startup via the lifespan handler.  The function
is idempotent: if the seed user already exists the script is a no-op.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, AsyncSession

from app.models import Expense, User


# ---------------------------------------------------------------------------
# Seed user
# ---------------------------------------------------------------------------
SEED_USER_ID = uuid.UUID("d290f1ee-6c54-4b01-90e6-d701748f0851")
SEED_USER_NAME = "Pushpendra Suryawanshi"
SEED_USER_ROLE = "employee"


# ---------------------------------------------------------------------------
# Sample expense rows — realistic Indian data, amounts in PAISE
# ---------------------------------------------------------------------------
def _utc(y: int, m: int, d: int, h: int = 0, mi: int = 0) -> datetime:
    """Helper: create a timezone-aware UTC datetime."""
    return datetime(y, m, d, h, mi, tzinfo=timezone.utc)


SAMPLE_EXPENSES: list[dict] = [
    {
        "id": uuid.UUID("a1b2c3d4-0001-4000-a000-000000000001"),
        "reference_id": "OPE-A7K291",
        "amount_minor": 6840,          # ₹68.40
        "currency": "INR",
        "expense_date": date(2024, 10, 3),
        "merchant": "Uber India",
        "category": "cab_local_transport",
        "reason": "Cab to client office for project kickoff meeting",
        "receipt_type": "payment_screenshot",
        "txn_ref": "UBER-9A8F3D",
        "extraction_status": "ok",
        "idempotency_key": "seed-001",
        "created_at": _utc(2024, 10, 3, 10, 15),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0002-4000-a000-000000000002"),
        "reference_id": "OPE-B3M472",
        "amount_minor": 15200,         # ₹152.00
        "currency": "INR",
        "expense_date": date(2024, 10, 5),
        "merchant": "Ola Cabs",
        "category": "cab_local_transport",
        "reason": "Airport pickup — Bengaluru domestic terminal",
        "receipt_type": "payment_screenshot",
        "txn_ref": "OLA-X22K91",
        "extraction_status": "ok",
        "idempotency_key": "seed-002",
        "created_at": _utc(2024, 10, 5, 8, 30),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0003-4000-a000-000000000003"),
        "reference_id": "OPE-C9T583",
        "amount_minor": 43500,         # ₹435.00
        "currency": "INR",
        "expense_date": date(2024, 10, 8),
        "merchant": "Swiggy",
        "category": "team_meals",
        "reason": "Team lunch ordered via Swiggy for sprint retro",
        "receipt_type": "bill_photo",
        "invoice_no": "SWG-2024-78431",
        "tax_amount_minor": 7830,      # ₹78.30 GST
        "extraction_status": "ok",
        "idempotency_key": "seed-003",
        "created_at": _utc(2024, 10, 8, 13, 0),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0004-4000-a000-000000000004"),
        "reference_id": "OPE-D1W694",
        "amount_minor": 32000,         # ₹320.00
        "currency": "INR",
        "expense_date": date(2024, 10, 11),
        "merchant": "Blue Tokai Coffee",
        "category": "client_meals_entertainment",
        "reason": "Coffee meeting with client stakeholders at Blue Tokai, Koramangala",
        "receipt_type": "bill_photo",
        "invoice_no": "BTC-10-0219",
        "tax_amount_minor": 5760,
        "extraction_status": "ok",
        "idempotency_key": "seed-004",
        "created_at": _utc(2024, 10, 11, 16, 45),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0005-4000-a000-000000000005"),
        "reference_id": "OPE-E5X705",
        "amount_minor": 875000,        # ₹8,750.00
        "currency": "INR",
        "expense_date": date(2024, 10, 14),
        "merchant": "Taj Hotel",
        "category": "travel",
        "reason": "Hotel stay for 2-day client workshop in Mumbai",
        "receipt_type": "bill_photo",
        "invoice_no": "TAJ-MUM-20241014-882",
        "tax_amount_minor": 157500,
        "extraction_status": "manual",
        "idempotency_key": "seed-005",
        "created_at": _utc(2024, 10, 14, 9, 0),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0006-4000-a000-000000000006"),
        "reference_id": "OPE-F8Y816",
        "amount_minor": 59900,         # ₹599.00
        "currency": "INR",
        "expense_date": date(2024, 10, 18),
        "merchant": "Vodafone",
        "category": "communication_data",
        "reason": "Monthly data plan recharge for work phone",
        "receipt_type": "payment_screenshot",
        "txn_ref": "VF-RCHG-20241018",
        "extraction_status": "ok",
        "idempotency_key": "seed-006",
        "created_at": _utc(2024, 10, 18, 11, 20),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0007-4000-a000-000000000007"),
        "reference_id": "OPE-G2Z927",
        "amount_minor": 124900,        # ₹1,249.00
        "currency": "INR",
        "expense_date": date(2024, 10, 22),
        "merchant": "Amazon Business",
        "category": "office_supplies",
        "reason": "Wireless mouse and USB-C hub for office setup",
        "receipt_type": "bill_photo",
        "invoice_no": "AMZ-IN-4028571",
        "tax_amount_minor": 22482,
        "extraction_status": "ok",
        "idempotency_key": "seed-007",
        "created_at": _utc(2024, 10, 22, 14, 10),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0008-4000-a000-000000000008"),
        "reference_id": "OPE-H6A038",
        "amount_minor": 78500,         # ₹785.00
        "currency": "INR",
        "expense_date": date(2024, 10, 26),
        "merchant": "BigBasket",
        "category": "other",
        "reason": "Pantry supplies for office kitchen restocking",
        "receipt_type": "none",
        "extraction_status": "manual",
        "idempotency_key": "seed-008",
        "created_at": _utc(2024, 10, 26, 17, 55),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0009-4000-a000-000000000009"),
        "reference_id": "OPE-J4K159",
        "amount_minor": 18000,         # ₹180.00
        "currency": "INR",
        "expense_date": date(2024, 10, 27),
        "merchant": "Chai Point",
        "category": "client_meals_entertainment",
        "reason": "Tea & quick snack with founder during BKC visit",
        "receipt_type": "payment_screenshot",
        "txn_ref": "CP-BKC-99120",
        "extraction_status": "ok",
        "idempotency_key": "seed-009",
        "created_at": _utc(2024, 10, 27, 16, 20),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0010-4000-a000-000000000010"),
        "reference_id": "OPE-K8L260",
        "amount_minor": 485000,        # ₹4,850.00
        "currency": "INR",
        "expense_date": date(2024, 10, 28),
        "merchant": "IndiGo Airlines",
        "category": "travel",
        "reason": "Return flight BOM-DEL for investor symposium",
        "receipt_type": "bill_photo",
        "invoice_no": "6E-INV-202410-7412",
        "tax_amount_minor": 24250,
        "extraction_status": "ok",
        "idempotency_key": "seed-010",
        "created_at": _utc(2024, 10, 28, 9, 45),
    },
]


# ---------------------------------------------------------------------------
# Main seed function
# ---------------------------------------------------------------------------
async def run_seed(engine: AsyncEngine) -> None:
    """Insert the seed user and sample expenses if they don't already exist.

    This is fully idempotent — safe to call on every startup.
    """
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Check whether seed user already exists
        result = await session.execute(
            select(User).where(User.id == SEED_USER_ID)
        )
        existing_user = result.scalar_one_or_none()

        if existing_user is not None:
            # Already seeded — nothing to do
            return

        # ---- Create user ----
        user = User(id=SEED_USER_ID, name=SEED_USER_NAME, role=SEED_USER_ROLE)
        session.add(user)

        # ---- Create sample expenses ----
        for exp_data in SAMPLE_EXPENSES:
            expense = Expense(user_id=SEED_USER_ID, **exp_data)
            session.add(expense)

        await session.commit()
