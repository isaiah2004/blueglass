"""GET /health and GET /ready — liveness and readiness are different questions."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.shared.errors import DependencyUnavailableError


async def test_health_is_ok_without_touching_the_database(
    client: AsyncClient, container
) -> None:
    """The container's DSN points at a closed port; /health must not care."""
    response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == container.settings.service_name
    assert body["environment"] == "test"


async def test_ready_reports_the_database_when_it_answers(
    client: AsyncClient, container, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def ping_ok() -> None:
        return None

    monkeypatch.setattr(container.database, "ping", ping_ok)

    response = await client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "checks": {"database": "ok"}}


async def test_ready_is_503_when_the_database_does_not_answer(
    client: AsyncClient, container, monkeypatch: pytest.MonkeyPatch
) -> None:
    """503, not 500: an unreachable database is an expected state, and the
    orchestrator should drain traffic rather than restart the process."""

    async def ping_fails() -> None:
        raise DependencyUnavailableError(
            "The database did not answer.", code="database_unavailable"
        )

    monkeypatch.setattr(container.database, "ping", ping_fails)

    response = await client.get("/ready")

    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "database_unavailable"
    assert error["details"]["checks"]["database"] == "unavailable"
