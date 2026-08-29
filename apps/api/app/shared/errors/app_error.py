"""The one error vocabulary every layer speaks.

Purpose
    Give domain and application code a way to fail that carries an HTTP-shaped
    meaning without importing FastAPI. `app/shared/http/exception_handlers.py`
    is the only place that translates these into responses, which keeps rule
    5.1.2 (the domain has zero infrastructure imports) true by construction.

Key responsibilities
    - Define the stable machine-readable `code` strings the client switches on.
      These are part of the API contract; renaming one is a breaking change.
    - Carry an optional `details` mapping for field-level context.

Dependencies
    Standard library only. Deliberately: this module is imported by the domain.

Usage
    raise NotFoundError("No verses for Prov 99 in BSB", code="chapter_not_found")
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


class AppError(Exception):
    """Base class for every failure this service reports deliberately.

    `status_code` is advisory metadata, not an HTTP dependency — it is a plain
    int that the presentation layer reads. Nothing here imports a web framework.
    """

    status_code: int = 500
    code: str = "internal_error"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        self.details: dict[str, Any] = dict(details or {})


class ValidationError(AppError):
    """The caller sent something structurally acceptable but semantically wrong."""

    status_code = 422
    code = "validation_error"


class NotFoundError(AppError):
    """The addressed resource does not exist."""

    status_code = 404
    code = "not_found"


class UnauthenticatedError(AppError):
    """No usable identity accompanied the request.

    Raised by the identity seam. Never raised with a fallback subject — the
    prototype's `dev-user` constant (`server/app/routers/user.py:15`) is exactly
    the defect this class exists to make impossible.
    """

    status_code = 401
    code = "identity_required"


class ConflictError(AppError):
    """The request cannot be applied to the current state of the resource."""

    status_code = 409
    code = "conflict"


class DependencyUnavailableError(AppError):
    """A backing service (database, embeddings) is not usable right now."""

    status_code = 503
    code = "dependency_unavailable"
