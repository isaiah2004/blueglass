"""Structured logging: one JSON object per line, correlated, no secrets."""

from __future__ import annotations

import json
import logging

from app.shared.logging import (
    JsonLogFormatter,
    bind_request_id,
    current_request_id,
    reset_request_id,
    sanitise_request_id,
)


def _record(message: str, **extra: object) -> logging.LogRecord:
    record = logging.LogRecord(
        name="atlas.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg=message,
        args=None,
        exc_info=None,
    )
    for key, value in extra.items():
        setattr(record, key, value)
    return record


def test_a_line_is_valid_json_with_the_core_schema() -> None:
    payload = json.loads(JsonLogFormatter().format(_record("hello")))

    assert set(payload) >= {"timestamp", "level", "logger", "message", "request_id"}
    assert payload["message"] == "hello"
    assert payload["level"] == "INFO"


def test_extra_fields_are_carried_through() -> None:
    payload = json.loads(
        JsonLogFormatter().format(_record("done", http_status=200, duration_ms=1.5))
    )

    assert payload["http_status"] == 200
    assert payload["duration_ms"] == 1.5


def test_extra_fields_cannot_overwrite_the_core_schema() -> None:
    """A colliding extra= is a bug at the call site, not a licence to rewrite
    the schema every log shipper depends on."""
    payload = json.loads(JsonLogFormatter().format(_record("x", level="FORGED")))

    assert payload["level"] == "INFO"


def test_the_current_request_id_is_used_when_the_record_carries_none() -> None:
    token = bind_request_id("corr-1")
    try:
        payload = json.loads(JsonLogFormatter().format(_record("x")))
    finally:
        reset_request_id(token)

    assert payload["request_id"] == "corr-1"


def test_outside_a_request_the_id_is_a_placeholder() -> None:
    assert current_request_id() == "-"


def test_a_well_formed_inbound_id_is_kept() -> None:
    assert sanitise_request_id("trace-abc.123") == "trace-abc.123"


def test_a_hostile_inbound_id_is_replaced() -> None:
    """The id is written into the log stream; a newline would forge a line."""
    for hostile in ("with space", "new\nline", "x" * 129, "", None):
        assert sanitise_request_id(hostile) != hostile
