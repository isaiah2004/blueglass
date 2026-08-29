"""Structured JSON log formatter.

Purpose
    Rule 7 forbids `print`/`console.log` and requires machine-readable logs. One
    JSON object per line means `docker compose logs api | jq` works, and a future
    log shipper needs no parser.

Key responsibilities
    - Emit a fixed core schema: timestamp, level, logger, message, request_id.
    - Merge `extra={...}` fields without letting them clobber the core schema.
    - Render exceptions as a formatted string field, never as a bare traceback
      on stderr.

Dependencies
    Standard library, plus `correlation` for the request id.

Usage
    handler.setFormatter(JsonLogFormatter())
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from .correlation import current_request_id

# Attributes `logging` puts on every record. Anything outside this set was added
# by the caller via `extra=` and is worth shipping.
_RESERVED: frozenset[str] = frozenset(
    logging.LogRecord("", 0, "", 0, "", None, None).__dict__
) | {"message", "asctime", "taskName"}

_CORE_FIELDS: frozenset[str] = frozenset(
    {"timestamp", "level", "logger", "message", "request_id", "error"}
)


class JsonLogFormatter(logging.Formatter):
    """Render a `LogRecord` as a single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(
                timespec="milliseconds"
            ),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None) or current_request_id(),
        }
        if record.exc_info:
            payload["error"] = self.formatException(record.exc_info)
        payload.update(self._extras(record))
        return json.dumps(payload, default=str, separators=(",", ":"))

    @staticmethod
    def _extras(record: logging.LogRecord) -> dict[str, Any]:
        """Caller-supplied `extra=` fields, minus anything that would overwrite
        a core field. A collision is a bug in the call site, not a licence to
        rewrite the schema, so the core value wins."""
        return {
            key: value
            for key, value in record.__dict__.items()
            if key not in _RESERVED and key not in _CORE_FIELDS
        }
