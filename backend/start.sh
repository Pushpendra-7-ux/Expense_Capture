#!/bin/bash
echo "=== Expense Capture Backend Startup ==="
echo "Python: $(python --version 2>&1)"
echo "PORT: ${PORT:-10000}"

# Test database connectivity before starting
echo "=== Testing database connection ==="
python -c "
import ssl, asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

async def test():
    url = os.environ.get('DATABASE_URL', '')
    print(f'DB URL prefix: {url[:50]}...')
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    engine = create_async_engine(url, connect_args={'ssl': ssl_ctx})
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT 1'))
        print(f'DB connection OK: {result.scalar()}')
    await engine.dispose()

try:
    asyncio.run(test())
except Exception as e:
    print(f'DB connection test failed: {e}')
" 2>&1

# Run alembic migrations (non-fatal)
echo "=== Running Alembic migrations ==="
python -m alembic upgrade head 2>&1 || echo "WARNING: Alembic failed, continuing anyway..."

# Start the server
echo "=== Starting Uvicorn ==="
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-10000}"
