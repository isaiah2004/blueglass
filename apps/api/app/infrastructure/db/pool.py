"""The asyncpg connection pool — the service's only door to Postgres.

Purpose
    Own the pool lifecycle so use cases never construct a connection and never
    see a DSN. There is no ORM: SQL is written where it runs and reviewed as
    SQL (the prototype made the same call, and it is the right one for a
    read-heavy scripture API).

Key responsibilities
    - Open the pool during application startup and close it on shutdown.
    - Decode jsonb columns into Python objects rather than raw strings.
    - Turn a connection failure into a typed DependencyUnavailableError, so the
      readiness probe can report it instead of a 500 with a traceback.

Dependencies
    asyncpg, the settings object, the shared error vocabulary.

Usage
    pool = Database(settings)
    await pool.connect()      # once, from the lifespan
    async with pool.acquire() as conn: ...
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import asyncpg

# Imported from the leaf module, not the package: app.config's __init__ also
# exports the Container, which imports this file. Going via the package would
# be a circular import.
from ...config.settings import Settings
from ...shared.errors import DependencyUnavailableError

_logger = logging.getLogger("atlas.db")

#: Failures that mean "the database is not reachable" rather than "your query is
#: wrong". OSError covers socket.gaierror (DNS gone, which is what a stopped
#: container looks like from inside the network), ConnectionRefusedError and
#: TimeoutError. PostgresConnectionError covers a server that answered and then
#: refused; InterfaceError covers a pool whose connections have been invalidated.
#: A PostgresError that is NOT one of these -- a check violation, an undefined
#: table -- is a real fault and must not be disguised as an outage.
_CONNECTION_FAILURES = (
    OSError,
    asyncpg.PostgresConnectionError,
    asyncpg.InterfaceError,
)


async def _init_connection(connection: asyncpg.Connection) -> None:
    """Round-trip jsonb as Python dicts and lists, not as text."""
    await connection.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


class Database:
    """A lazily-opened asyncpg pool with a typed failure mode."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pool: asyncpg.Pool | None = None

    @property
    def is_connected(self) -> bool:
        """True once the pool exists. Says nothing about server reachability."""
        return self._pool is not None

    async def connect(self) -> None:
        """Open the pool. Idempotent, so a reload cannot open a second one."""
        if self._pool is not None:
            return
        try:
            self._pool = await asyncpg.create_pool(
                dsn=self._settings.dsn,
                min_size=self._settings.db_pool_min_size,
                max_size=self._settings.db_pool_max_size,
                timeout=self._settings.db_connect_timeout_seconds,
                init=_init_connection,
            )
        except (OSError, asyncpg.PostgresError) as exc:
            # Startup must not hard-crash the container: /health has to stay up
            # so an operator can see the service is alive but not ready.
            _logger.warning("database pool unavailable at startup", exc_info=exc)
            self._pool = None

    async def disconnect(self) -> None:
        """Close the pool and drop the reference."""
        if self._pool is None:
            return
        await self._pool.close()
        self._pool = None

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[asyncpg.Connection]:
        """Borrow a connection, reconnecting once if the pool is not open.

        A database that has gone away is an EXPECTED, retryable state, not a
        bug, so it becomes a typed DependencyUnavailableError (503) rather than
        an unhandled exception (500). The distinction is what lets the reader
        say "we cannot reach the library right now" instead of "something broke".

        The mapping deliberately wraps only the ACQUIRE, never the yield: a
        constraint violation or a syntax error inside the caller's query is a
        real fault and must keep propagating as itself.
        """
        if self._pool is None:
            await self.connect()
        if self._pool is None:
            raise DependencyUnavailableError(
                "The database is not reachable.", code="database_unavailable"
            )
        try:
            connection = await self._pool.acquire()
        except _CONNECTION_FAILURES as exc:
            raise DependencyUnavailableError(
                "The database is not reachable.", code="database_unavailable"
            ) from exc
        try:
            yield connection
        finally:
            await self._pool.release(connection)

    async def fetch(self, query: str, *args: Any) -> list[asyncpg.Record]:
        """Run a read and return every row."""
        async with self.acquire() as connection:
            return await connection.fetch(query, *args)

    async def fetchrow(self, query: str, *args: Any) -> asyncpg.Record | None:
        """Run a read and return the first row, or None."""
        async with self.acquire() as connection:
            return await connection.fetchrow(query, *args)

    async def execute(self, query: str, *args: Any) -> str:
        """Run a write and return the driver status tag."""
        async with self.acquire() as connection:
            return await connection.execute(query, *args)

    async def ping(self) -> None:
        """Prove the server answers. Raises DependencyUnavailableError if not.

        Broader than `acquire`: readiness asks "can this instance serve traffic",
        and any PostgresError at all -- including a missing table from an
        unapplied migration -- means no.
        """
        try:
            async with self.acquire() as connection:
                await connection.fetchval("SELECT 1")
        except (OSError, asyncpg.PostgresError, asyncpg.InterfaceError) as exc:
            raise DependencyUnavailableError(
                "The database did not answer.", code="database_unavailable"
            ) from exc
