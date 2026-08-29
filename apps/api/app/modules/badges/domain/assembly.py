"""Run every builder over one chapter, then apply the selection rules.

Purpose
    The five builders each answer for their own kind. Something has to run all
    five and then decide what the reader actually sees. That something is one
    pure function, so the whole badge pipeline -- from records to the final
    ordered list -- can be exercised in a unit test with no database, no HTTP
    and no application layer.

Order matters
    Builders first, selection second, never interleaved. A builder that knew
    about the chapter cap would start making selection decisions with only its
    own kind in view, and the per-verse rule cannot be applied by any single
    builder because it spans kinds.

Dependencies
    The badge domain only. Pure. Rule 5.1.2.
"""

from __future__ import annotations

from .badge import InlineBadge
from .builders import (
    build_city_badges,
    build_cross_ref_badges,
    build_history_badges,
    build_root_badges,
    build_route_badges,
)
from .chapter_data import ChapterBadgeData
from .provenance import SourceAttribution
from .selection import select_chapter_badges

#: Every builder, in P-04's listing order. Adding a sixth badge kind is adding
#: a line here plus a quota in `selection.py`, and nothing else.
_BUILDERS = (
    build_route_badges,
    build_city_badges,
    build_history_badges,
    build_root_badges,
    build_cross_ref_badges,
)


def assemble_chapter_badges(data: ChapterBadgeData) -> list[InlineBadge]:
    """The badges one chapter renders, in reading order.

    @param data: Everything the repository loaded for the chapter. An aggregate
        with no enrichment is fine and yields an empty list -- absence of data
        is not an error condition.
    @returns The selected badges, ordered by `InlineBadge.sort_key`, identical
        on every call for identical input. Side effects: none.
    """
    candidates: list[InlineBadge] = []
    for build in _BUILDERS:
        candidates.extend(build(data))
    return select_chapter_badges(candidates)


def cited_sources(badges: list[InlineBadge]) -> tuple[SourceAttribution, ...]:
    """Every distinct source the chapter's badges rest on, in a stable order.

    AI-05 requires the UI to display attribution. Collecting it once per
    chapter lets the reader see the whole provenance of the page without
    opening five sheets, and lets a share-alike source be spotted by a WHERE
    clause rather than by reading prose.
    """
    seen: dict[str, SourceAttribution] = {}
    for badge in badges:
        for source in badge.sources:
            seen.setdefault(source.key, source)
    return tuple(seen[key] for key in sorted(seen))
