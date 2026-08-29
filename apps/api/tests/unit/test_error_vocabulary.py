"""The error vocabulary: codes are contract, and the domain imports nothing."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from app.shared.errors import (
    AppError,
    ConflictError,
    DependencyUnavailableError,
    NotFoundError,
    UnauthenticatedError,
    ValidationError,
)

_APP_ROOT = Path(__file__).resolve().parents[2] / "app"

_FORBIDDEN_IN_DOMAIN = ("fastapi", "starlette", "asyncpg", "sqlalchemy", "pydantic")


@pytest.mark.parametrize(
    ("error_class", "status", "code"),
    [
        (ValidationError, 422, "validation_error"),
        (NotFoundError, 404, "not_found"),
        (UnauthenticatedError, 401, "identity_required"),
        (ConflictError, 409, "conflict"),
        (DependencyUnavailableError, 503, "dependency_unavailable"),
    ],
)
def test_default_status_and_code(error_class: type[AppError], status: int, code: str) -> None:
    raised = error_class("boom")

    assert raised.status_code == status
    assert raised.code == code
    assert raised.details == {}


def test_a_call_site_may_narrow_the_code_but_not_the_status() -> None:
    """Narrowing the code is how one status carries several meanings."""
    raised = NotFoundError("nope", code="book_not_found", details={"book": "x"})

    assert (raised.status_code, raised.code) == (404, "book_not_found")
    assert raised.details == {"book": "x"}


def _domain_modules() -> list[Path]:
    return sorted(_APP_ROOT.glob("modules/*/domain/*.py"))


def test_there_are_domain_modules_to_check() -> None:
    assert _domain_modules(), "no domain modules found; the guard below is vacuous"


@pytest.mark.parametrize("module", _domain_modules(), ids=lambda p: p.name)
def test_the_domain_layer_imports_no_infrastructure(module: Path) -> None:
    """Rule 5.1.2, enforced rather than hoped for."""
    tree = ast.parse(module.read_text(encoding="utf-8"))
    imported: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.append(node.module)

    offenders = [
        name
        for name in imported
        if any(name.split(".")[0] == banned for banned in _FORBIDDEN_IN_DOMAIN)
    ]
    assert offenders == []
