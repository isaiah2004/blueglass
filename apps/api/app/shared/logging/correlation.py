"""Request correlation id, carried without threading it through every call.

Purpose
    Every log line emitted while handling a request must name that request, so a
    developer can grep one id and see the whole story (rule 7, logging &
    observability). A `ContextVar` gives that to code that never sees the
    `Request` object — repositories, use cases, the domain.

Key responsibilities
    - Hold the current request id for the duration of one request.
    - Mint an id when the caller did not supply one.

Dependencies
    Standard library only.

Usage
    token = bind_request_id(incoming_or_new_id())
    try:
        ...
    finally:
        reset_request_id(token)
"""

from __future__ import annotations

import re
import uuid
from contextvars import ContextVar, Token

_REQUEST_ID: ContextVar[str] = ContextVar("atlas_request_id", default="-")

# Client-supplied ids are echoed into logs, so they are constrained to a boring
# alphabet and a bounded length. An unbounded header would let a caller write
# arbitrary text (including newlines) into the log stream — log injection.
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def new_request_id() -> str:
    """Mint a fresh correlation id."""
    return uuid.uuid4().hex


def sanitise_request_id(candidate: str | None) -> str:
    """Return `candidate` if it is a safe correlation id, else a fresh one."""
    if candidate is not None and _SAFE_REQUEST_ID.match(candidate):
        return candidate
    return new_request_id()


def bind_request_id(request_id: str) -> Token[str]:
    """Make `request_id` current for this task. Returns the reset token."""
    return _REQUEST_ID.set(request_id)


def reset_request_id(token: Token[str]) -> None:
    """Undo a `bind_request_id`, restoring the previous value."""
    _REQUEST_ID.reset(token)


def current_request_id() -> str:
    """The correlation id of the request in flight, or `"-"` outside one."""
    return _REQUEST_ID.get()
