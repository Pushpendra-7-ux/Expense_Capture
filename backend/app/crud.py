"""
app/crud.py — Database operations for Expense Capture (OPE).

Handles:
- Cryptographic reference ID generation (OPE-XXXXXX).
- Idempotent expense creation via Idempotency-Key.
- Duplicate detection (txn_ref match, or merchant + amount_minor + expense_date for user).
- Cursor-based list pagination and single item lookup.
"""

from __future__ import annotations

import secrets
import string
import uuid
from datetime import datetime
from typing import Sequence

from sqlalchemy import func, select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Expense, ExpenseAttachment, User
from app.schemas import ExpenseCreate
from app.seed import SEED_USER_ID

# Characters for reference_id: uppercase letters + digits, omitting ambiguous characters (0, O, I, 1)
ALPHANUM = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def generate_reference_id() -> str:
    """Generate a reference ID in the format OPE-XXXXXX (6 alphanumeric chars)."""
    random_part = "".join(secrets.choice(ALPHANUM) for _ in range(6))
    return f"OPE-{random_part}"


async def get_or_create_seeded_user(session: AsyncSession) -> User:
    """Ensure the seeded user exists and return it."""
    result = await session.execute(select(User).where(User.id == SEED_USER_ID))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            id=SEED_USER_ID,
            name="Pushpendra Suryawanshi",
            role="employee",
        )
        session.add(user)
        await session.commit()
    return user


async def check_idempotency(
    session: AsyncSession,
    idempotency_key: str,
) -> Expense | None:
    """Check if an expense with the given idempotency_key was already created."""
    query = select(Expense).where(Expense.idempotency_key == idempotency_key)
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def check_duplicate(
    session: AsyncSession,
    user_id: uuid.UUID,
    payload: ExpenseCreate,
) -> bool:
    """
    Check if a matching expense exists:
    - txn_ref matches (if non-null)
    - OR (merchant + amount_minor + expense_date) match for this user
    """
    clauses = []

    # 1. txn_ref match if provided
    if payload.txn_ref and payload.txn_ref.strip():
        clauses.append(
            (Expense.user_id == user_id) & (Expense.txn_ref == payload.txn_ref.strip())
        )

    # 2. merchant + amount_minor + expense_date match
    if payload.merchant and payload.merchant.strip():
        clauses.append(
            (Expense.user_id == user_id)
            & (func.lower(Expense.merchant) == payload.merchant.strip().lower())
            & (Expense.amount_minor == payload.amount_minor)
            & (Expense.expense_date == payload.expense_date)
        )

    if not clauses:
        return False

    query = select(Expense.id).where(or_(*clauses)).limit(1)
    result = await session.execute(query)
    return result.scalar_one_or_none() is not None


async def create_expense(
    session: AsyncSession,
    payload: ExpenseCreate,
    idempotency_key: str,
    user_id: uuid.UUID | None = None,
) -> Expense:
    """
    Create an expense with idempotency and duplicate checking.
    If idempotency_key exists, returns existing expense.
    """
    uid = user_id or SEED_USER_ID

    # 1. Idempotency check
    existing = await check_idempotency(session, idempotency_key)
    if existing:
        return existing

    # 2. Duplicate detection
    is_duplicate = await check_duplicate(session, uid, payload)

    # 3. Unique reference_id generation with collision retry
    for _ in range(5):
        ref_id = generate_reference_id()
        check = await session.execute(
            select(Expense.id).where(Expense.reference_id == ref_id)
        )
        if check.scalar_one_or_none() is None:
            break
    else:
        # Fallback if somehow collisions occur
        ref_id = f"OPE-{uuid.uuid4().hex[:6].upper()}"

    # 4. Construct Expense record
    expense = Expense(
        reference_id=ref_id,
        user_id=uid,
        amount_minor=payload.amount_minor,
        currency=payload.currency,
        expense_date=payload.expense_date,
        merchant=payload.merchant.strip() if payload.merchant else None,
        category=payload.category.value,
        reason=payload.reason.strip(),
        receipt_type=payload.receipt_type.value,
        txn_ref=payload.txn_ref.strip() if payload.txn_ref else None,
        invoice_no=payload.invoice_no.strip() if payload.invoice_no else None,
        tax_amount_minor=payload.tax_amount_minor,
        extraction_status=payload.extraction_status.value,
        extraction_json=payload.extraction_json,
        extracted_amount_minor=payload.extracted_amount_minor,
        extracted_date=payload.extracted_date,
        extracted_merchant=payload.extracted_merchant,
        edited_fields=payload.edited_fields or [],
        possible_duplicate=is_duplicate,
        idempotency_key=idempotency_key,
    )
    session.add(expense)
    await session.flush()  # get expense.id

    # 5. Link any pre-uploaded attachments
    if payload.attachment_ids:
        for aid in payload.attachment_ids:
            att = await session.get(ExpenseAttachment, aid)
            if att and att.expense_id is None:
                att.expense_id = expense.id

    await session.commit()
    await session.refresh(expense)
    return expense


async def get_expense_by_id(
    session: AsyncSession,
    identifier: str,
    user_id: uuid.UUID | None = None,
) -> Expense | None:
    """Fetch an expense by UUID or by reference_id (e.g., OPE-A7K291)."""
    uid = user_id or SEED_USER_ID

    # Check if identifier is a valid UUID
    try:
        val_uuid = uuid.UUID(identifier)
        query = (
            select(Expense)
            .options(selectinload(Expense.attachments))
            .where((Expense.id == val_uuid) & (Expense.user_id == uid))
        )
    except ValueError:
        # Otherwise search by reference_id
        query = (
            select(Expense)
            .options(selectinload(Expense.attachments))
            .where((Expense.reference_id == identifier.upper()) & (Expense.user_id == uid))
        )

    result = await session.execute(query)
    expense = result.scalar_one_or_none()
    if expense:
        expense.attachment_count = len(expense.attachments)
    return expense


async def list_expenses(
    session: AsyncSession,
    user_id: uuid.UUID | None = None,
    cursor: str | None = None,
    limit: int = 20,
) -> tuple[Sequence[Expense], str | None, bool, int]:
    """
    List expenses for the current user, newest first.
    Uses created_at cursor pagination.
    Returns: (items, next_cursor, has_more, total_count)
    """
    uid = user_id or SEED_USER_ID

    # Total count query
    count_res = await session.execute(
        select(func.count(Expense.id)).where(Expense.user_id == uid)
    )
    total_count = count_res.scalar_one() or 0

    # Query items with attachments eager-loaded
    query = (
        select(Expense)
        .options(selectinload(Expense.attachments))
        .where(Expense.user_id == uid)
    )

    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(Expense.created_at < cursor_dt)
        except Exception:
            pass

    query = query.order_by(Expense.created_at.desc()).limit(limit + 1)
    result = await session.execute(query)
    rows = result.scalars().all()

    for r in rows:
        r.attachment_count = len(r.attachments)

    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = items[-1].created_at.isoformat() if has_more and items else None

    return items, next_cursor, has_more, total_count
