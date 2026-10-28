"""
app/database.py — Async SQLAlchemy engine, session factory, and dependency.

Uses asyncpg as the PostgreSQL driver with lazy engine initialization
so model definitions and unit tests can be imported without requiring
an active database driver at import time.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# ---------------------------------------------------------------------------
# Declarative base for all ORM models.
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""

    pass


# ---------------------------------------------------------------------------
# Lazy Engine & Sessionmaker
# ---------------------------------------------------------------------------
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """Return the global async engine, creating it if needed."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            pool_size=5,
            max_overflow=10,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the session factory bound to the global engine."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


class _EngineProxy:
    """Proxy object so code importing `engine` can call `.dispose()`, etc."""

    def __getattr__(self, name: str) -> Any:
        return getattr(get_engine(), name)


engine: Any = _EngineProxy()


# ---------------------------------------------------------------------------
# FastAPI dependency — yields one session per request.
# ---------------------------------------------------------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional async session for a single request."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
