"""A database that has gone away is a 503, not a 500.

REGRESSION. Found by stopping the `db` container against the running API, not by
a test: `/translations` and `/chapters/...` answered `500 internal_error`. That
is wrong twice over. It tells the reader "something broke" when the honest answer
is "we cannot reach the library right now", and it tells an operator to look for
a bug when the fix is to start Postgres. M1's definition of done requires the
reader to degrade with a friendly message when the backend is killed mid-session.

The mapping has to be narrow. A check violation or an undefined table is a REAL
fault and must keep propagating as itself — disguising a schema bug as an outage
would send the next person to the wrong place entirely.
"""

from __future__ import annotations

import socket

import asyncpg
import pytest

from app.config import Settings
from app.infrastructure.db import Database
from app.infrastructure.db.pool import _CONNECTION_FAILURES
from app.shared.errors import DependencyUnavailableError


class _FailingPool:
    """A pool whose acquire raises whatever it was constructed with."""

    def __init__(self, error: BaseException) -> None:
        self._error = error

    async def acquire(self) -> object:
        raise self._error

    async def release(self, connection: object) -> None:  # pragma: no cover
        raise AssertionError("release must not run when acquire failed")


@pytest.fixture
def database() -> Database:
    return Database(Settings(database_url="postgresql://x:x@127.0.0.1:1/x"))


@pytest.mark.parametrize(
    "error",
    [
        # What a stopped container actually looks like from inside the network:
        # the service name stops resolving.
        socket.gaierror(-2, "Name or service not known"),
        ConnectionRefusedError("connection refused"),
        TimeoutError("timed out"),
        asyncpg.PostgresConnectionError("server closed the connection"),
        asyncpg.InterfaceError("pool is closing"),
    ],
    ids=["dns-gone", "refused", "timeout", "server-closed", "pool-closing"],
)
async def test_a_connection_failure_becomes_a_typed_outage(
    database: Database, error: BaseException
) -> None:
    database._pool = _FailingPool(error)  # type: ignore[assignment]

    with pytest.raises(DependencyUnavailableError) as raised:
        async with database.acquire():
            pass

    assert raised.value.code == "database_unavailable"
    assert raised.value.status_code == 503
    assert raised.value.__cause__ is error


def test_real_sql_faults_are_not_disguised_as_outages() -> None:
    """The guard must not swallow a schema or constraint bug."""
    for real_fault in (
        asyncpg.CheckViolationError,
        asyncpg.UndefinedTableError,
        asyncpg.NotNullViolationError,
        asyncpg.ForeignKeyViolationError,
    ):
        assert not issubclass(real_fault, _CONNECTION_FAILURES)


async def test_ping_reports_an_unreachable_database(database: Database) -> None:
    """Readiness must answer, not raise something the probe cannot classify."""
    with pytest.raises(DependencyUnavailableError) as raised:
        await database.ping()

    assert raised.value.code == "database_unavailable"
