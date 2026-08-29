"""The single response shape every failure takes.

Purpose
    A client should never have to guess whether an error is `{"detail": "..."}`,
    `{"detail": [{...}]}` or a stack trace. FastAPI produces all three by
    default. This module defines one envelope and the presentation layer uses it
    for every non-2xx response, without exception.

Wire shape
    {
      "error": {
        "code": "chapter_not_found",       // stable, machine-readable
        "message": "No verses for ...",    // human-readable, safe to display
        "details": { ... },                // optional, structured context
        "request_id": "8f2c..."            // matches the X-Request-Id header
      }
    }

Dependencies
    Pydantic only. No FastAPI, so the shape can be reused by any transport.

Usage
    envelope = error_envelope(code="not_found", message="...", request_id=rid)
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    """The `error` object inside the envelope."""

    code: str = Field(description="Stable machine-readable error code.")
    message: str = Field(description="Human-readable explanation, safe to show.")
    details: dict[str, Any] = Field(
        default_factory=dict,
        description="Structured context: offending fields, allowed values.",
    )
    request_id: str = Field(description="Correlation id; matches X-Request-Id.")


class ErrorResponse(BaseModel):
    """The complete error response body."""

    error: ErrorBody


def error_envelope(
    *,
    code: str,
    message: str,
    request_id: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the serialised envelope for one failure."""
    body = ErrorBody(
        code=code,
        message=message,
        details=details or {},
        request_id=request_id,
    )
    return ErrorResponse(error=body).model_dump()
