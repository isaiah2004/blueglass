"""Shared fixtures.

Two kinds of test live here, deliberately.

  Contract tests build the real application, then REPLACE the container's
  repositories with in-memory doubles. They exercise routing, validation, the
  error envelope, the identity seam and every documented status code, in
  milliseconds, with no database. That is what makes it affordable to test every
  error path rather than only the happy one.

  Integration tests talk to a live Postgres and are skipped unless
  ATLAS_TEST_DATABASE_URL is set. They cover the things a double cannot prove:
  that the SQL is valid, that the indexes exist, and that the pgvector distance
  operator ranks the way the score maths assumes.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings
from app.config.container import Container
from app.main import create_app
from tests.doubles import (
    InMemoryIdentityRepository,
    InMemoryScriptureRepository,
    InMemoryStudyRepository,
)

TEST_DEVICE_ID = "test-device-0123456789"
DEVICE_HEADER = "X-Atlas-Device-Id"


@pytest.fixture
def settings() -> Settings:
    """Settings for a test app. The DSN is never dialled by contract tests."""
    return Settings(
        environment="test",
        log_level="WARNING",
        database_url="postgresql://unused:unused@127.0.0.1:1/unused",
    )


@pytest.fixture
def container(settings: Settings) -> Container:
    """A real container with its repositories swapped for doubles.

    Swapping at the container is the point of the composition root: no route,
    use case or schema knows the difference.
    """
    built = Container(settings)
    built.scripture_repository = InMemoryScriptureRepository()
    built.identity_repository = InMemoryIdentityRepository()
    built.author_registry = built.identity_repository
    built.study_repository = InMemoryStudyRepository()
    built._wire_use_cases()
    return built


@pytest.fixture
async def client(container: Container) -> AsyncIterator[AsyncClient]:
    """An httpx client bound to the ASGI app, with no network involved."""
    app = create_app(container.settings, container=container)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://api.test") as http:
        yield http


@pytest.fixture
def identified() -> dict[str, str]:
    """Headers carrying a valid device identity."""
    return {DEVICE_HEADER: TEST_DEVICE_ID}


@pytest.fixture
def live_database_url() -> str:
    """The DSN for integration tests, or skip."""
    dsn = os.environ.get("ATLAS_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("ATLAS_TEST_DATABASE_URL is not set; skipping integration test.")
    return dsn
