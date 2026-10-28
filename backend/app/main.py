"""
app/main.py — FastAPI application entry-point for Expense Capture (OPE).

Endpoints:
- POST /expenses               (Idempotent creation, server validation, duplicate flag)
- GET  /expenses               (Paginated list, newest first, cursor support)
- GET  /expenses/{id}          (Single expense detail by UUID or reference_id)
- POST /expenses/attachments   (Upload & validate attachments: magic-bytes, size, PDF pages)
- GET  /expenses/{id}/attachments/{aid} (Serve attachment: stored Content-Type, nosniff, inline)
- GET  /attachments/{aid}      (Serve unattached/draft attachment preview)
- GET  /health                 (Liveness probe)
"""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crud import create_expense, get_expense_by_id, list_expenses
from app.database import engine, get_db, get_session_factory
from app.file_validation import (
    FileValidationError,
    validate_file,
    MAX_FILES,
)
from app.extraction_service import extraction_service
from app.rate_limiter import check_and_increment_rate_limits, get_client_ip
from app.schemas import (
    AttachmentInfo,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseResponse,
)
from app.seed import run_seed
from app.storage import storage

logger = logging.getLogger("ope")
logging.basicConfig(level=logging.INFO)


# ---------------------------------------------------------------------------
# Lifespan — runs seed on startup, cleans up orphans, disposes engine on shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: seed DB on startup, clean up orphans, clean up on shutdown."""
    logger.info("Starting up — running database seed…")
    try:
        await run_seed(engine)
        logger.info("Seed complete.")
    except Exception:
        logger.exception("Seed failed — check database connectivity.")

    # 24h orphan attachment cleanup on startup
    try:
        session_factory = get_session_factory()
        async with session_factory() as session:
            cleaned = await storage.cleanup_orphans(session, max_age_hours=24)
            if cleaned:
                logger.info("Cleaned up %d orphan attachments older than 24h.", cleaned)
    except Exception:
        logger.exception("Orphan cleanup failed.")

    yield
    await engine.dispose()
    logger.info("Engine disposed. Goodbye.")


# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Expense Capture (OPE)",
    version="0.3.0",
    description="Backend API for Dexter Capital Expense Capture (OPE).",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# CORS middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a generic 500 for any unhandled exception."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["ops"])
async def health_check() -> dict:
    """Liveness probe — returns OK with a UTC timestamp."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# File Attachment Endpoints
# ---------------------------------------------------------------------------
@app.post(
    "/expenses/attachments",
    response_model=list[AttachmentInfo],
    status_code=status.HTTP_201_CREATED,
    tags=["attachments"],
    summary="Upload and validate file attachments (max 3 files)",
)
async def upload_attachments(
    files: list[UploadFile] = File(...),
    kind: str = Form("bill"),
    db: AsyncSession = Depends(get_db),
) -> list[AttachmentInfo]:
    """
    Upload 1 to 3 receipt images or PDFs.
    Validates magic bytes, file size, PDF encryption and page count.
    Saves binary data behind the StorageBackend interface.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided.",
        )

    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many files ({len(files)}). Maximum allowed is {MAX_FILES}.",
        )

    valid_kinds = {"bill", "payment_screenshot", "supporting"}
    if kind not in valid_kinds:
        kind = "bill"

    results: list[AttachmentInfo] = []

    for f in files:
        content = await f.read()
        filename = f.filename or "uploaded_file"

        try:
            validated = validate_file(filename, content)
        except FileValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )

        saved = await storage.save(
            session=db,
            file_bytes=validated.file_bytes,
            mime=validated.mime,
            kind=kind,
            filename=validated.filename,
        )

        results.append(
            AttachmentInfo(
                id=saved.id,
                mime=saved.mime,
                filename=saved.filename,
                kind=saved.kind,
            )
        )

    await db.commit()
    return results


@app.get(
    "/expenses/{identifier}/attachments/{aid}",
    tags=["attachments"],
    summary="Serve an attachment for a submitted expense",
)
async def get_expense_attachment(
    identifier: str,
    aid: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Serve a stored attachment:
    - Stored Content-Type
    - X-Content-Type-Options: nosniff
    - Content-Disposition: inline
    """
    expense = await get_expense_by_id(session=db, identifier=identifier)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense '{identifier}' not found",
        )

    data = await storage.get(session=db, attachment_id=aid)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    file_bytes, mime, filename = data
    safe_filename = filename or f"attachment_{aid}"

    return Response(
        content=file_bytes,
        media_type=mime,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'inline; filename="{safe_filename}"',
        },
    )


@app.get(
    "/attachments/{aid}",
    tags=["attachments"],
    summary="Serve an attachment preview (draft or submitted)",
)
async def get_attachment_preview(
    aid: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Serve attachment preview directly by attachment ID."""
    data = await storage.get(session=db, attachment_id=aid)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    file_bytes, mime, filename = data
    safe_filename = filename or f"attachment_{aid}"

    return Response(
        content=file_bytes,
        media_type=mime,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'inline; filename="{safe_filename}"',
        },
    )


# ---------------------------------------------------------------------------
# Extraction Endpoint (Phase 4)
# ---------------------------------------------------------------------------
@app.post(
    "/expenses/extract",
    status_code=status.HTTP_200_OK,
    tags=["extraction"],
    summary="Auto-extract expense details using Gemini Flash (0-3 files + optional note)",
)
async def extract_expense(
    request: Request,
    files: list[UploadFile] = File(default=[]),
    note: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Auto-extract expense details from uploaded bill photos, screenshots, and optional note.
    - Rate limits check (per-IP and global daily cap)
    - Validates magic bytes, size, PDF pages & encryption
    - Stores attachments via storage backend
    - Checks Postgres extraction_cache
    - Calls Gemini with structured output, retries, and 20s budget
    - Verifies amounts, dates, and cross-checks code-side
    - Always returns HTTP 200 with draft object (never blocks manual entry)
    """
    # Rate limit check
    client_ip = get_client_ip(request)
    allowed, err_msg = await check_and_increment_rate_limits(db, client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=err_msg or "Rate limit exceeded. Please wait a bit.",
        )

    clean_note = note.strip() if note else None
    if not files and not clean_note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file or note is required for extraction.",
        )

    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many files ({len(files)}). Maximum allowed is {MAX_FILES}.",
        )

    # Validate and save files
    validated_files_data: list[tuple[bytes, str]] = []
    file_hashes: list[str] = []
    saved_attachment_ids: list[uuid.UUID] = []

    for f in files:
        content = await f.read()
        filename = f.filename or "receipt_file"

        try:
            validated = validate_file(filename, content)
        except FileValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )

        saved = await storage.save(
            session=db,
            file_bytes=validated.file_bytes,
            mime=validated.mime,
            kind="bill",
            filename=validated.filename,
        )
        saved_attachment_ids.append(saved.id)
        file_hashes.append(saved.sha256)
        validated_files_data.append((validated.file_bytes, validated.mime))

    await db.commit()

    # Call extraction service
    draft = await extraction_service.extract(
        session=db,
        files_data=validated_files_data,
        file_hashes=file_hashes,
        note=clean_note,
        attachment_ids=saved_attachment_ids,
        thinking_level="low",
    )

    return draft


# ---------------------------------------------------------------------------
# Expense endpoints
# ---------------------------------------------------------------------------
@app.post(
    "/expenses",
    response_model=ExpenseResponse,
    status_code=status.HTTP_200_OK,
    tags=["expenses"],
    summary="Submit a new expense (Idempotent)",
)
async def submit_expense(
    payload: ExpenseCreate,
    idempotency_key: str = Header(
        ...,
        alias="Idempotency-Key",
        description="Unique client-generated idempotency key (UUIDv4 recommended)",
    ),
    db: AsyncSession = Depends(get_db),
) -> ExpenseResponse:
    """
    Submit an expense claim.
    Requires `Idempotency-Key` header.
    Repeated calls with the same key safely return the existing record without re-creating.
    """
    key_clean = idempotency_key.strip()
    if not key_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key header cannot be empty",
        )

    expense = await create_expense(
        session=db,
        payload=payload,
        idempotency_key=key_clean,
    )
    # Refresh to include linked attachments
    fetched = await get_expense_by_id(session=db, identifier=str(expense.id))
    return ExpenseResponse.model_validate(fetched or expense)


@app.get(
    "/expenses",
    response_model=ExpenseListResponse,
    tags=["expenses"],
    summary="List past expenses",
)
async def get_expenses(
    cursor: str | None = Query(None, description="ISO timestamp for pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Max items to return"),
    db: AsyncSession = Depends(get_db),
) -> ExpenseListResponse:
    """
    List past expenses for the current user, newest first.
    Supports cursor-based pagination.
    """
    items, next_cursor, has_more, total_count = await list_expenses(
        session=db,
        cursor=cursor,
        limit=limit,
    )
    return ExpenseListResponse(
        items=[ExpenseResponse.model_validate(i) for i in items],
        next_cursor=next_cursor,
        has_more=has_more,
        total_count=total_count,
    )


@app.get(
    "/expenses/{identifier}",
    response_model=ExpenseResponse,
    tags=["expenses"],
    summary="Get single expense detail",
)
async def get_single_expense(
    identifier: str,
    db: AsyncSession = Depends(get_db),
) -> ExpenseResponse:
    """
    Retrieve single expense details by UUID or reference_id (e.g. OPE-A7K291).
    """
    expense = await get_expense_by_id(session=db, identifier=identifier)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense '{identifier}' not found",
        )
    return ExpenseResponse.model_validate(expense)
