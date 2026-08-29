"""Fixtures for the badge contract tests.

Named `badge_*` rather than shadowing the `container` and `client` fixtures in
`tests/conftest.py`: those are shared by every other contract test in this
package, and redefining them here would change the environment of tests this
module does not own.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.config.container import Container
from app.main import create_app
from tests.contract.badge_doubles import InMemoryBadgeRepository


@pytest.fixture
def badge_repository() -> InMemoryBadgeRepository:
    """The double, exposed so a test can assert on how it was called."""
    return InMemoryBadgeRepository()


@pytest.fixture
def badge_container(
    container: Container, badge_repository: InMemoryBadgeRepository
) -> Container:
    """The shared test container with its badge repository swapped."""
    container.badge_repository = badge_repository
    container._wire_use_cases()
    return container


@pytest.fixture
async def badge_client(badge_container: Container) -> AsyncIterator[AsyncClient]:
    """An httpx client bound to the ASGI app, with no network involved."""
    app = create_app(badge_container.settings, container=badge_container)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://api.test") as http:
        yield http
