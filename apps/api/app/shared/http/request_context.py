"""Correlation-id middleware.

Purpose
    Bind a request id for the lifetime of every request and hand it back to the
    caller in `X-Request-Id`, so a user reporting "it failed" can quote one
    token that finds every log line for that request.

Key responsibilities
    - Reuse an inbound `X-Request-Id` when it is well-formed, else mint one.
    - Bind it into the logging context and unbind it in a `finally`.
    - Log one structured access line per request, with duration and status.

Dependencies
    Starlette's `BaseHTTPMiddleware`, the shared logging package.

Usage
    app.add_middleware(RequestContextMiddleware)
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..logging import bind_request_id, reset_request_id, sanitise_request_id

REQUEST_ID_HEADER = "X-Request-Id"

_logger = logging.getLogger("atlas.access")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach a correlation id to every request and log its outcome."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = sanitise_request_id(request.headers.get(REQUEST_ID_HEADER))
        token = bind_request_id(request_id)
        # Exception handlers run inside the middleware stack and need the id to
        # put in the envelope; request.state is how they reach it.
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            reset_request_id(token)
        self._log(request, response, request_id, time.perf_counter() - started)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response

    @staticmethod
    def _log(request: Request, response: Response, request_id: str, elapsed: float) -> None:
        """Emit the access line. Query strings are logged; they carry search
        terms, which are not secrets, and no endpoint accepts a credential in
        the query string."""
        _logger.info(
            "request completed",
            extra={
                "request_id": request_id,
                "http_method": request.method,
                "http_path": request.url.path,
                "http_query": request.url.query,
                "http_status": response.status_code,
                "duration_ms": round(elapsed * 1000, 2),
            },
        )
