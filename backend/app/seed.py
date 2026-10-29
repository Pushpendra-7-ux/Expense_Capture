"""
app/seed.py — Seed the database with a default user and sample expenses.

Called once on application startup via the lifespan handler. The function is
idempotent: if the seed user already exists the function is a no-op.

The demo feed is intentionally small (7 claims, ₹3,420.50) and mirrors the
reference product screens: a mix of approved and in-review claims, with real
receipt files attached to the first two items.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

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
# Demo data helpers
# ---------------------------------------------------------------------------
_KOLKATA = ZoneInfo("Asia/Kolkata")
_TODAY = datetime.now(_KOLKATA).date()


def _days_ago(days: int, hour: int, minute: int = 0) -> datetime:
    """UTC timestamp for `days` before today at the given *IST* wall time.

    Storing IST wall-clock times converted to UTC means the feed and detail
    screens render the intended 2:15 PM, 8:10 PM, etc. regardless of where
    the server or browser is running.

    A same-day demo entry is clamped to the recent past so a claim is never
    timestamped in the future when the app is opened in the morning.
    """
    day = _TODAY - timedelta(days=days)
    local = datetime.combine(day, time(hour, minute), tzinfo=_KOLKATA)
    value = local.astimezone(timezone.utc)
    now = datetime.now(timezone.utc)
    if value > now:
        value = now - timedelta(minutes=15)
    return value


# ---------------------------------------------------------------------------
# Sample expense rows — realistic Indian data, amounts in PAISE.
# Total = ₹3,420.50 across 7 claims.
# ---------------------------------------------------------------------------
SAMPLE_EXPENSES: list[dict] = [
    {
        "id": uuid.UUID("a1b2c3d4-0001-4000-a000-000000000001"),
        "reference_id": "OPE-A7K291",
        "amount_minor": 6840,          # ₹68.40
        "currency": "INR",
        "expense_date": _TODAY,
        "merchant": "Uber",
        "category": "cab_local_transport",
        "reason": "Airport Transfer to Terminal 2",
        "receipt_type": "bill_photo",
        "txn_ref": "UBR-28OCT-8842",
        "review_status": "approved",
        "reviewed_by": "Partner Review • P. Sharma",
        "billable": True,
        "extraction_status": "ok",
        "idempotency_key": "seed-001",
        "created_at": _days_ago(0, 14, 15),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0002-4000-a000-000000000002"),
        "reference_id": "OPE-B3M472",
        "amount_minor": 34000,         # ₹340.00
        "currency": "INR",
        "expense_date": _TODAY - timedelta(days=1),
        "merchant": "The Grill House",
        "category": "client_meals_entertainment",
        "reason": "Client Dinner (Founders Fund)",
        "receipt_type": "bill_photo",
        "review_status": "under_review",
        "reviewed_by": "Finance Review • In progress",
        "billable": True,
        "extraction_status": "ok",
        "idempotency_key": "seed-002",
        "created_at": _days_ago(1, 20, 10),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0003-4000-a000-000000000003"),
        "reference_id": "OPE-D1W694",
        "amount_minor": 1850,          # ₹18.50
        "currency": "INR",
        "expense_date": _TODAY - timedelta(days=3),
        "merchant": "Blue Tokai Coffee",
        "category": "client_meals_entertainment",
        "reason": "Discussion with Series B team",
        "receipt_type": "bill_photo",
        "invoice_no": "BTC-10-0219",
        "review_status": "approved",
        "reviewed_by": "Partner Review • P. Sharma",
        "billable": True,
        "extraction_status": "ok",
        "idempotency_key": "seed-003",
        "created_at": _days_ago(3, 11, 20),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0004-4000-a000-000000000004"),
        "reference_id": "OPE-K8L260",
        "amount_minor": 245000,        # ₹2,450.00
        "currency": "INR",
        "expense_date": _TODAY - timedelta(days=5),
        "merchant": "IndiGo Airlines",
        "category": "travel",
        "reason": "Return flight BOM-DEL for investor symposium",
        "receipt_type": "bill_photo",
        "invoice_no": "6E-INV-202410-7412",
        "tax_amount_minor": 24500,
        "review_status": "approved",
        "reviewed_by": "Partner Review • P. Sharma",
        "billable": True,
        "extraction_status": "ok",
        "idempotency_key": "seed-004",
        "created_at": _days_ago(5, 9, 45),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0005-4000-a000-000000000005"),
        "reference_id": "OPE-E5X705",
        "amount_minor": 45000,         # ₹450.00
        "currency": "INR",
        "expense_date": _TODAY - timedelta(days=8),
        "merchant": "Taj Hotel",
        "category": "travel",
        "reason": "Airport transit hotel for client workshop",
        "receipt_type": "bill_photo",
        "invoice_no": "TAJ-MUM-20241014-882",
        "tax_amount_minor": 4500,
        "review_status": "approved",
        "reviewed_by": "Partner Review • P. Sharma",
        "billable": True,
        "extraction_status": "ok",
        "idempotency_key": "seed-005",
        "created_at": _days_ago(8, 16, 30),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0006-4000-a000-000000000006"),
        "reference_id": "OPE-G2Z927",
        "amount_minor": 8560,          # ₹85.60
        "currency": "INR",
        "expense_date": _TODAY - timedelta(days=12),
        "merchant": "Amazon Business",
        "category": "office_supplies",
        "reason": "USB-C hub and notebook for desk setup",
        "receipt_type": "bill_photo",
        "invoice_no": "AMZ-IN-4028571",
        "review_status": "rejected",
        "reviewed_by": "Finance Review • M. Iyer",
        "review_note": "Personal desk purchase — not reimbursable under OPE policy.",
        "billable": True,
        "extraction_status": "ok",
        "idempotency_key": "seed-006",
        "created_at": _days_ago(12, 14, 10),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0007-4000-a000-000000000007"),
        "reference_id": "OPE-J4K159",
        "amount_minor": 800,           # ₹8.00
        "currency": "INR",
        "expense_date": _TODAY - timedelta(days=15),
        "merchant": "Chai Point",
        "category": "team_meals",
        "reason": "Team chai after late client call",
        "receipt_type": "payment_screenshot",
        "txn_ref": "CP-BKC-99120",
        "review_status": "approved",
        "reviewed_by": "Partner Review • P. Sharma",
        "billable": True,
        "extraction_status": "ok",
        "idempotency_key": "seed-007",
        "created_at": _days_ago(15, 17, 20),
    },
]


# Attachment files bundled with the demo. They make the detail screen a real
# end-to-end artefact instead of a mocked UI.
SAMPLE_ATTACHMENTS: dict[str, dict[str, str]] = {
    "OPE-A7K291": {
        "filename": "uber_trip_28oct.pdf",
        "mime": "application/pdf",
        "kind": "bill",
    },
    "OPE-D1W694": {
        "filename": "blue_tokai_bill_11oct.jpg",
        "mime": "image/jpeg",
        "kind": "bill",
    },
}


# ---------------------------------------------------------------------------
# Gemini extraction snapshots
# ---------------------------------------------------------------------------
# Every demo claim carries the draft Gemini produced so the finance console can
# open the exact reading the employee reviewed. These are derived from the same
# fields as the claim itself, keeping the ledger and the AI snapshot consistent.
_EXTRACTION_NOTES: dict[str, list[str]] = {
    "Uber": ["Payment status reads SUCCESS on the trip receipt."],
    "The Grill House": [
        "Restaurant bill includes service charge; no GSTIN printed.",
    ],
    "Blue Tokai Coffee": ["Bill total matches the amount due."],
    "IndiGo Airlines": ["Base fare and taxes are shown separately."],
    "Taj Hotel": ["Invoice includes GST and breakfast; zero balance due."],
    "Amazon Business": [
        "Order total includes delivery; invoice addressed to Dexter Capital.",
    ],
    "Chai Point": [
        "UPI reference and payment status verified from the screenshot.",
    ],
}

# A ten-line restaurant bill is part of the demo data so the itemized-receipt UI
# is exercised on first launch, not only when a real bill happens to be long.
_SEED_LINE_ITEMS: dict[str, list[dict]] = {
    "OPE-B3M472": [
        {"description": "Masala chai", "amount": 20.0},
        {"description": "Filter coffee", "amount": 20.0},
        {"description": "Fresh lime soda", "amount": 30.0},
        {"description": "Garlic bread", "amount": 40.0},
        {"description": "Veg spring rolls", "amount": 30.0},
        {"description": "Paneer tikka", "amount": 50.0},
        {"description": "Caesar salad", "amount": 40.0},
        {"description": "Pasta arrabbiata", "amount": 50.0},
        {"description": "Brownie", "amount": 30.0},
        {"description": "Service charge", "amount": 30.0},
    ],
}


def build_extraction_payload(
    *,
    reference_id: str,
    amount_minor: int,
    expense_date,
    merchant: str | None,
    category: str,
    reason: str,
    receipt_type: str,
    txn_ref: str | None = None,
    invoice_no: str | None = None,
    tax_amount_minor: int | None = None,
) -> dict:
    """Build the stored Gemini draft for a demo claim.

    Mirrors the shape returned by ``ExtractionService.extract`` so both the
    review screen and finance console read it the same way.
    """
    date_str = (
        expense_date.isoformat()
        if hasattr(expense_date, "isoformat")
        else str(expense_date)
    )
    confidence = {
        "amount": 0.99,
        "date": 0.98,
        "merchant": 0.97,
        "category": 0.93,
        "reason": 0.91,
    }
    if receipt_type == "payment_screenshot":
        confidence["merchant"] = 0.94
        confidence["reason"] = 0.88

    raw_line_items = _SEED_LINE_ITEMS.get(reference_id, [])
    line_items = [
        {
            "description": item["description"],
            "amount": round(float(item["amount"]), 2),
            "amount_minor": int(round(float(item["amount"]) * 100)),
        }
        for item in raw_line_items
    ]
    line_items_total = (
        round(sum(item["amount"] for item in line_items), 2) if line_items else None
    )

    return {
        "status": "ok",
        "fields": {
            "amount_minor": amount_minor,
            "amount_rupees": f"{amount_minor / 100:.2f}",
            "expense_date": date_str,
            "merchant": merchant,
            "category": category,
            "reason": reason[:140],
            "receipt_type": receipt_type,
            "txn_ref": txn_ref,
            "invoice_no": invoice_no,
            "tax_amount_minor": tax_amount_minor,
        },
        "confidence": confidence,
        "receipt_type": receipt_type,
        "conflicts": [],
        "cross_checks": {
            "amount": "match",
            "payee": "match",
            "date": "match",
        },
        "reason_suggestion": reason[:140],
        "notices": _EXTRACTION_NOTES.get(merchant or "", []),
        "attachment_ids": [],
        "line_items": line_items,
        "line_items_total": line_items_total,
        "raw_extraction": {
            "merchant": merchant,
            "total_amount": amount_minor / 100,
            "currency": "INR",
            "line_items": raw_line_items,
        },
    }


for _seed_row in SAMPLE_EXPENSES:
    _seed_row["extraction_json"] = build_extraction_payload(
        reference_id=_seed_row["reference_id"],
        amount_minor=_seed_row["amount_minor"],
        expense_date=_seed_row["expense_date"],
        merchant=_seed_row.get("merchant"),
        category=_seed_row["category"],
        reason=_seed_row["reason"],
        receipt_type=_seed_row["receipt_type"],
        txn_ref=_seed_row.get("txn_ref"),
        invoice_no=_seed_row.get("invoice_no"),
        tax_amount_minor=_seed_row.get("tax_amount_minor"),
    )


async def _backfill_seed_data(session: AsyncSession) -> None:
    """Refresh demo extraction snapshots and repair demo timestamps."""
    references = [row["reference_id"] for row in SAMPLE_EXPENSES]
    result = await session.execute(
        select(Expense).where(Expense.reference_id.in_(references))
    )
    changed = False
    now = datetime.now(timezone.utc)
    for expense in result.scalars():
        if expense.created_at and expense.created_at > now:
            expense.created_at = now - timedelta(minutes=15)
            changed = True
        payload = build_extraction_payload(
            reference_id=expense.reference_id,
            amount_minor=expense.amount_minor,
            expense_date=expense.expense_date,
            merchant=expense.merchant,
            category=expense.category,
            reason=expense.reason,
            receipt_type=expense.receipt_type,
            txn_ref=expense.txn_ref,
            invoice_no=expense.invoice_no,
            tax_amount_minor=expense.tax_amount_minor,
        )
        if expense.extraction_json != payload:
            expense.extraction_json = payload
            changed = True
    if changed:
        await session.commit()



async def run_seed(engine: AsyncEngine) -> None:
    """Insert the seed user, demo expenses, and receipt files if missing."""
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with session_factory() as session:
        result = await session.execute(select(User).where(User.id == SEED_USER_ID))
        if result.scalar_one_or_none() is not None:
            await _backfill_seed_data(session)
            return

        session.add(User(id=SEED_USER_ID, name=SEED_USER_NAME, role=SEED_USER_ROLE))

        expenses_by_ref: dict[str, Expense] = {}
        for data in SAMPLE_EXPENSES:
            expense = Expense(user_id=SEED_USER_ID, **data)
            session.add(expense)
            expenses_by_ref[expense.reference_id] = expense

        # Flush so attachment foreign keys can reference the new rows.
        await session.flush()

        samples_dir = Path(__file__).resolve().parents[2] / "samples"
        demo_files = {
            "OPE-A7K291": "uber_trip_28oct.pdf",
            "OPE-D1W694": "sample_coffee_bill.jpg",
        }

        # Imported lazily to avoid a circular import at module load time.
        from app.storage import storage

        for reference_id, meta in SAMPLE_ATTACHMENTS.items():
            expense = expenses_by_ref.get(reference_id)
            file_path = samples_dir / demo_files[reference_id]
            if expense is None or not file_path.exists():
                continue
            await storage.save(
                session=session,
                file_bytes=file_path.read_bytes(),
                mime=meta["mime"],
                kind=meta["kind"],
                filename=meta["filename"],
                expense_id=expense.id,
            )

        await session.commit()
