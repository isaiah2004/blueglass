"""DEFECT 1 — auth is fake: every /me route resolved to the string dev-user.

Source of the defect
    A:/Work/spark/spark-app/server/app/routers/user.py line 15:

        STUB_USER = "dev-user"
        def current_user() -> str:
            return STUB_USER

    Every note, highlight, preference and saved conversation in the prototype
    belongs to that one row. Two phones share a library; there is no way to tell
    them apart, and no way to add real accounts without rewriting every route.

What must stay true
    1. No identified endpoint answers without a credential.
    2. Two different device ids get two different subjects and cannot see each
       other's data.
    3. The literal dev-user appears nowhere in the service.

Each test below fails if the defect is reintroduced.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest
from httpx import AsyncClient

from tests.conftest import DEVICE_HEADER

_SOURCE_ROOT = Path(__file__).resolve().parents[2] / "app"
_IDENTIFIED_ROUTES = ("/me", "/me/prefs")


@pytest.mark.parametrize("path", _IDENTIFIED_ROUTES)
async def test_identified_route_rejects_a_request_with_no_credential(
    client: AsyncClient, path: str
) -> None:
    """No header, no identity. The prototype answered 200 with dev-user."""
    response = await client.get(path)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "identity_required"


async def test_identified_route_rejects_a_malformed_device_id(
    client: AsyncClient,
) -> None:
    """A device id becomes a primary key, so it is validated, not trusted."""
    response = await client.get("/me", headers={DEVICE_HEADER: "short"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_device_id"


async def test_two_devices_resolve_to_two_different_subjects(
    client: AsyncClient,
) -> None:
    """The whole point of A-01: one device, one subject."""
    first = await client.get("/me", headers={DEVICE_HEADER: "device-aaaaaaaaaaaa"})
    second = await client.get("/me", headers={DEVICE_HEADER: "device-bbbbbbbbbbbb"})

    assert first.json()["subject"] != second.json()["subject"]
    assert first.json()["kind"] == "device"


async def test_one_device_cannot_read_another_devices_preferences(
    client: AsyncClient,
) -> None:
    """Data is scoped to the subject, not to a shared constant."""
    alice = {DEVICE_HEADER: "device-alice-000000"}
    bob = {DEVICE_HEADER: "device-bob-00000000"}

    await client.put("/me/prefs", headers=alice, json={"prefs": {"verseSize": 21}})
    bobs_view = await client.get("/me/prefs", headers=bob)

    assert bobs_view.status_code == 200
    assert bobs_view.json() == {"prefs": {}}


def _string_constants(source: str) -> list[str]:
    """Every string literal in a module that is not a docstring.

    Parsing rather than grepping is deliberate: the modules that CLOSE this
    defect necessarily describe it in their docstrings, and a grep would flag
    the fix as the bug. What must never come back is an executable constant.
    """
    tree = ast.parse(source)
    docstrings = {
        ast.get_docstring(node, clean=False)
        for node in ast.walk(tree)
        if isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef)
    }
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and node.value not in docstrings
    ]


def test_no_module_holds_a_hardcoded_user_as_a_string_constant() -> None:
    """The defect was a constant, and a constant can come back in a hurry during
    a debugging session and never leave."""
    offenders = [
        f"{path.relative_to(_SOURCE_ROOT)}: {literal!r}"
        for path in _SOURCE_ROOT.rglob("*.py")
        for literal in _string_constants(path.read_text(encoding="utf-8"))
        if "dev-user" in literal
    ]

    assert offenders == []
