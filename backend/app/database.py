"""
app/database.py — Async SQLAlchemy engine, session factory, and dependency.

Uses asyncpg as the PostgreSQL driver with lazy engine initialization
so model definitions and unit tests can be imported without requiring
an active database driver at import time.

Supports Supabase (remote PostgreSQL with SSL) out of the box.
"""

from __future__ import annotations

import ssl
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


def _is_remote_db(url: str) -> bool:
    """Return True when the DATABASE_URL points to a remote host (not localhost)."""
    return "localhost" not in url and "127.0.0.1" not in url


def get_engine() -> AsyncEngine:
    """Return the global async engine, creating it if needed.

    When connecting to Supabase or any remote PostgreSQL, an SSL context
    is configured automatically so asyncpg can complete the TLS handshake.
    """
    global _engine
    if _engine is None:
        import logging
        logger = logging.getLogger("ope")
        connect_args: dict = {}
        is_remote = _is_remote_db(settings.DATABASE_URL)
        logger.info("Creating DB engine: remote=%s, url_prefix=%s", is_remote, settings.DATABASE_URL[:50])
        if is_remote:
            # Supabase requires SSL; use a permissive context so self-signed
            # or Let's Encrypt certs are accepted without a local CA bundle.
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            connect_args["ssl"] = ssl_ctx
            logger.info("SSL context configured for remote DB")

        _engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            pool_size=5,
            max_overflow=10,
            connect_args=connect_args,
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
