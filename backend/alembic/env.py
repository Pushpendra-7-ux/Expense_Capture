"""
alembic/env.py — Async Alembic environment for Expense Capture (OPE).

Uses the ``run_async`` pattern with asyncpg so that migrations execute
inside an async event loop.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.database import Base

# Alembic Config object — gives access to alembic.ini values.
config = context.config

# Override the URL from settings (which reads .env).
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Logging configuration from the ini file.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate support.
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline mode — generates plain SQL scripts without a live connection.
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online (async) mode — connects via asyncpg and runs migrations.
# ---------------------------------------------------------------------------
def do_run_migrations(connection) -> None:  # noqa: ANN001
    """Execute migrations inside a synchronous callback."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (async)."""
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Entry-point
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
