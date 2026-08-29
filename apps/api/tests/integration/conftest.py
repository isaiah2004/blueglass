"""Fixtures for tests that need a live Postgres.

These are the tests a double cannot replace: they prove the SQL parses, the
indexes exist, the generated tsvector column works, and pgvector ranks the way
the score arithmetic assumes.

Set ATLAS_TEST_DATABASE_URL to run them. Inside the compose stack:

    docker compose exec -e ATLAS_TEST_DATABASE_URL=$DATABASE_URL api pytest -m integration

Each test runs inside a transaction that is ROLLED BACK, so the suite is
re-runnable against a database that has real scripture loaded without ever
disturbing it.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import asyncpg
import pytest

from app.infrastructure.db.pool import init_connection

pytestmark = pytest.mark.integration


@pytest.fixture
async def connection(live_database_url: str) -> AsyncIterator[asyncpg.Connection]:
    """A connection whose work is always rolled back.

    Configured with the pool's own `init_connection`, so a statement is proven
    against the driver setup that serves requests rather than against a bare
    connection that decodes jsonb as text.
    """
    conn = await asyncpg.connect(dsn=live_database_url)
    await init_connection(conn)
    transaction = conn.transaction()
    await transaction.start()
    try:
        yield conn
    finally:
        await transaction.rollback()
        await conn.close()
