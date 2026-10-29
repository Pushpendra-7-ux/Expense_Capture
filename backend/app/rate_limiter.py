"""
app/rate_limiter.py — Postgres-backed rate limiting for Expense Capture (OPE).

Enforces:
1. Per-IP hourly rolling window limit (default: 20 requests/hour).
2. Daily global extraction cap across all users (default: 300 extractions/day).
3. All counters live in PostgreSQL (rate_limits table), NEVER in process memory.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Tuple

from fastapi import HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import RateLimit

logger = logging.getLogger("ope.ratelimit")
KOLKATA_TZ = ZoneInfo("Asia/Kolkata")


def get_client_ip(request: Request) -> str:
    """Extract client IP, taking into account trusted proxy if configured."""
    if settings.TRUSTED_PROXY:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # First IP in the comma-separated list is the client
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


async def check_and_increment_rate_limits(
    session: AsyncSession,
    client_ip: str,
) -> Tuple[bool, str | None]:
    """
    Check both:
    1. Global daily cap (__global__ sentinel)
    2. Per-IP hourly limit

    Returns (allowed, error_message).
    """
    if not settings.RATE_LIMIT_ENABLED:
        return True, None

    now_utc = datetime.now(timezone.utc)

    # 1. Check Global Daily Cap
    # Day bucket in UTC or Kolkata (use today's start in UTC for consistency)
    day_window = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Query or insert daily global limit
    global_stmt = (
        insert(RateLimit)
        .values(
            client_ip="__global__",
            window_start=day_window,
            count=1,
        )
        .on_conflict_do_update(
            index_elements=["client_ip", "window_start"],
            set_={"count": RateLimit.count + 1},
        )
        .returning(RateLimit.count)
    )
    
    try:
        res = await session.execute(global_stmt)
        global_count = res.scalar_one()
        if global_count > settings.DAILY_GLOBAL_CAP:
            logger.warning("Global daily extraction cap exceeded: %d/%d", global_count, settings.DAILY_GLOBAL_CAP)
            return False, "Daily extraction limit reached for the organization. Please enter details manually."
    except Exception as e:
        logger.error("Error updating global rate limit: %s", str(e))
        # If DB query fails, don't crash extraction unless strict
        pass

    # 2. Check Per-IP Hourly Limit
    hour_window = now_utc.replace(minute=0, second=0, microsecond=0)
    ip_stmt = (
        insert(RateLimit)
        .values(
            client_ip=client_ip,
            window_start=hour_window,
            count=1,
        )
        .on_conflict_do_update(
            index_elements=["client_ip", "window_start"],
            set_={"count": RateLimit.count + 1},
        )
        .returning(RateLimit.count)
    )

    try:
        res_ip = await session.execute(ip_stmt)
        ip_count = res_ip.scalar_one()
        if ip_count > settings.RATE_LIMIT_PER_IP:
            logger.warning("Per-IP rate limit exceeded for %s: %d/%d", client_ip, ip_count, settings.RATE_LIMIT_PER_IP)
            return False, "Too many extraction requests from this device. Please wait a bit or enter details manually."
    except Exception as e:
        logger.error("Error updating IP rate limit: %s", str(e))
        pass

    return True, None
