"""Pure functions that turn one chapter's records into badge candidates.

Each builder answers one question -- "which Route badges does this chapter
justify?" -- and answers it with no I/O, no clock and no randomness, so the
same chapter yields the same badges on every call. Selection (how many survive)
is not their job; that is `domain/selection.py`.
"""

from .crossref import build_cross_ref_badges
from .history import build_history_badges
from .root import build_root_badges
from .route import build_route_badges
from .spatial import build_city_badges

__all__ = [
    "build_city_badges",
    "build_cross_ref_badges",
    "build_history_badges",
    "build_root_badges",
    "build_route_badges",
]
