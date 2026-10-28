"""
app/storage.py — Storage abstraction for Expense Attachments.

Provides an abstract interface so attachment storage can easily transition
from PostgreSQL BYTEA to S3 / Cloudflare R2 without rewriting API routes.
"""

from __future__ import annotations

import hashlib
import uuid
from abc import ABC, abstractmethod
from typing import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ExpenseAttachment


class StorageBackend(ABC):
    """Abstract interface for file storage."""

    @abstractmethod
    async def save(
        self,
        session: AsyncSession,
        file_bytes: bytes,
        mime: str,
        kind: str,
        filename: str | None = None,
        expense_id: uuid.UUID | None = None,
    ) -> ExpenseAttachment:
        """Store file bytes and return the ExpenseAttachment model."""
        pass

    @abstractmethod
    async def get(
        self,
        session: AsyncSession,
        attachment_id: uuid.UUID,
    ) -> tuple[bytes, str, str | None] | None:
        """Retrieve (file_bytes, mime, filename) by attachment_id."""
        pass

    @abstractmethod
    async def delete(
        self,
        session: AsyncSession,
        attachment_id: uuid.UUID,
    ) -> bool:
        """Delete attachment by id."""
        pass

    @abstractmethod
    async def cleanup_orphans(
        self,
        session: AsyncSession,
        max_age_hours: int = 24,
    ) -> int:
        """Delete unattached files older than max_age_hours."""
        pass


class DatabaseStorageBackend(StorageBackend):
    """PostgreSQL BYTEA storage implementation."""

    async def save(
        self,
        session: AsyncSession,
        file_bytes: bytes,
        mime: str,
        kind: str,
        filename: str | None = None,
        expense_id: uuid.UUID | None = None,
    ) -> ExpenseAttachment:
        sha256 = hashlib.sha256(file_bytes).hexdigest()
        attachment = ExpenseAttachment(
            expense_id=expense_id,
            file_bytes=file_bytes,
            mime=mime,
            filename=filename,
            sha256=sha256,
            kind=kind,
        )
        session.add(attachment)
        await session.flush()
        return attachment

    async def get(
        self,
        session: AsyncSession,
        attachment_id: uuid.UUID,
    ) -> tuple[bytes, str, str | None] | None:
        att = await session.get(ExpenseAttachment, attachment_id)
        if att is None:
            return None
        return att.file_bytes, att.mime, att.filename

    async def delete(
        self,
        session: AsyncSession,
        attachment_id: uuid.UUID,
    ) -> bool:
        att = await session.get(ExpenseAttachment, attachment_id)
        if att is not None:
            await session.delete(att)
            await session.commit()
            return True
        return False

    async def cleanup_orphans(
        self,
        session: AsyncSession,
        max_age_hours: int = 24,
    ) -> int:
        from datetime import datetime, timezone, timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        stmt = (
            delete(ExpenseAttachment)
            .where((ExpenseAttachment.expense_id.is_(None)) & (ExpenseAttachment.created_at < cutoff))
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount or 0


# Default active storage singleton
storage: StorageBackend = DatabaseStorageBackend()
