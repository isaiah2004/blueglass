"""Every failure, whatever raised it, comes back in ONE shape.

FastAPI's defaults produce three different bodies -- {"detail": "..."} for an
HTTPException, {"detail": [ ... ]} for a validation error, and a plain-text 500
for anything unhandled. A client cannot branch on that. These tests hold the
single envelope in place, including for the routes FastAPI itself generates.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.config.container import Container
from app.main import create_app

_ENVELOPE_KEYS = {"code", "message", "details", "request_id"}


def _error(payload: dict) -> dict:
    assert set(payload) == {"error"}
    assert set(payload["error"]) == _ENVELOPE_KEYS
    return payload["error"]


async def test_unrouted_path_uses_the_envelope(client: AsyncClient) -> None:
    """Even Starlette's own 404 conforms."""
    response = await client.get("/no-such-route")

    assert response.status_code == 404
    assert _error(response.json())["code"] == "not_found"


async def test_wrong_method_uses_the_envelope(client: AsyncClient) -> None:
    response = await client.post("/books")

    assert response.status_code == 405
    assert _error(response.json())["code"] == "method_not_allowed"


async def test_validation_failure_names_the_offending_field(
    client: AsyncClient,
) -> None:
    response = await client.get("/chapters/BSB/Proverbs/0")

    assert response.status_code == 422
    error = _error(response.json())
    assert error["code"] == "validation_error"
    assert error["details"]["fields"][0]["location"][-1] == "chapter"


async def test_domain_failure_carries_its_own_code_and_details(
    client: AsyncClient,
) -> None:
    response = await client.get("/chapters/BSB/Nowhere/1")

    assert response.status_code == 404
    error = _error(response.json())
    assert error["code"] == "book_not_found"
    assert error["details"] == {"book": "Nowhere"}


async def test_every_response_carries_a_correlation_id(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.headers["X-Request-Id"]


async def test_an_inbound_correlation_id_is_reused(client: AsyncClient) -> None:
    """A client that already has a trace id keeps it, so one id spans the hop."""
    response = await client.get("/health", headers={"X-Request-Id": "abc-123"})

    assert response.headers["X-Request-Id"] == "abc-123"


async def test_a_hostile_correlation_id_is_replaced(client: AsyncClient) -> None:
    """The id lands in the log stream, so it cannot carry newlines."""
    response = await client.get("/health", headers={"X-Request-Id": "bad id\nINJECTED"})

    assert response.headers["X-Request-Id"] != "bad id\nINJECTED"


async def test_the_error_envelope_repeats_the_correlation_id(
    client: AsyncClient,
) -> None:
    response = await client.get("/no-such-route", headers={"X-Request-Id": "trace-9"})

    assert _error(response.json())["request_id"] == "trace-9"


async def test_an_unexpected_exception_is_a_500_with_no_internals(
    container: Container, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An exception message can carry a DSN or a row of user data, so the client
    gets a correlation id and nothing else."""

    async def explode() -> None:
        raise RuntimeError("connection to postgres://atlas:hunter2@db/atlas failed")

    monkeypatch.setattr(container.scripture_repository, "list_translations", explode)
    app = create_app(container.settings, container=container)
    transport = ASGITransport(app=app, raise_app_exceptions=False)

    async with AsyncClient(transport=transport, base_url="http://api.test") as http:
        response = await http.get("/translations")

    assert response.status_code == 500
    error = _error(response.json())
    assert error["code"] == "internal_error"
    assert "hunter2" not in response.text
