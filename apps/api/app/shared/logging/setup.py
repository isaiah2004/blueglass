"""Logging bootstrap — called exactly once, from the composition root.

Purpose
    Put every log line in the process onto one JSON handler, including the ones
    uvicorn and FastAPI emit, so nothing escapes as unstructured text.

Key responsibilities
    - Replace the root handler set (rather than adding to it) so a reload does
      not double every line.
    - Silence uvicorn's own handlers by delegating them to the root logger.

Dependencies
    `json_formatter`. No application imports — this runs before the app exists.

Usage
    configure_logging(level="INFO")
"""

from __future__ import annotations

import logging
import sys

from .json_formatter import JsonLogFormatter

# uvicorn installs its own colourised handlers. Left alone they would emit a
# second, unstructured copy of every access line.
_DELEGATING_LOGGERS: tuple[str, ...] = ("uvicorn", "uvicorn.error", "uvicorn.access")


def configure_logging(level: str = "INFO") -> None:
    """Install the JSON formatter as the process-wide logging configuration."""
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(JsonLogFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    for name in _DELEGATING_LOGGERS:
        logger = logging.getLogger(name)
        logger.handlers = []
        logger.propagate = True
