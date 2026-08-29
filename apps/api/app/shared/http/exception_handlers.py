"""Translate every failure into the one error envelope.

Purpose
    FastAPI's defaults produce three different error shapes and, for an
    unhandled exception, a 500 whose body is plain text. Rule 6 (error handling)
    wants one shape and no leaked internals. These handlers are the only place
    in the service that turns an exception into a response.

Key responsibilities
    - AppError        -> its own status, code and details.
    - HTTPException   -> a mapped code, so third-party raises still conform.
    - Validation      -> 422 with the offending fields in details.
    - Anything else   -> 500 internal_error, logged with the traceback, with the
                         message withheld from the client.

Dependencies
    FastAPI/Starlette, the shared error vocabulary and envelope.

Usage
    register_exception_handlers(app)
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from ..errors import AppError
from ..logging import current_request_id
from .error_envelope import error_envelope

_logger = logging.getLogger("atlas.error")

# Codes for the HTTPExceptions raised by the framework itself (404 on an
# unrouted path, 405 on a bad method) so even those obey the envelope.
_STATUS_CODES: dict[int, str] = {
    400: "bad_request",
    401: "identity_required",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    415: "unsupported_media_type",
    422: "validation_error",
    429: "rate_limited",
    503: "dependency_unavailable",
}


def _request_id(request: Request) -> str:
    """The correlation id for this request, from state or the context var."""
    return getattr(request.state, "request_id", None) or current_request_id()


def _response(
    request: Request,
    *,
    status: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=error_envelope(
            code=code,
            message=message,
            request_id=_request_id(request),
            details=details,
        ),
    )


async def handle_app_error(request: Request, exc: Exception) -> JSONResponse:
    """A failure the service raised on purpose."""
    assert isinstance(exc, AppError)
    _logger.warning(
        "handled application error",
        extra={"error_code": exc.code, "http_status": exc.status_code},
    )
    return _response(
        request,
        status=exc.status_code,
        code=exc.code,
        message=exc.message,
        details=exc.details,
    )


async def handle_http_exception(request: Request, exc: Exception) -> JSONResponse:
    """An HTTPException from FastAPI, Starlette, or a dependency."""
    assert isinstance(exc, StarletteHTTPException)
    code = _STATUS_CODES.get(exc.status_code, "http_error")
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
    return _response(request, status=exc.status_code, code=code, message=detail)


async def handle_validation_error(request: Request, exc: Exception) -> JSONResponse:
    """Pydantic rejected the path, query, or body."""
    assert isinstance(exc, RequestValidationError)
    fields = [
        {
            "location": list(error.get("loc", ())),
            "message": error.get("msg", ""),
            "type": error.get("type", ""),
        }
        for error in exc.errors()
    ]
    return _response(
        request,
        status=422,
        code="validation_error",
        message="The request did not match the expected shape.",
        details={"fields": fields},
    )


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """Anything we did not anticipate. The traceback goes to the log; the client
    gets a correlation id and nothing else, because an exception message can
    carry a DSN, a query, or a row of user data."""
    _logger.exception("unhandled exception", exc_info=exc)
    return _response(
        request,
        status=500,
        code="internal_error",
        message="An unexpected error occurred. Quote the request id when reporting it.",
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Wire every handler above onto the app."""
    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(Exception, handle_unexpected_error)
