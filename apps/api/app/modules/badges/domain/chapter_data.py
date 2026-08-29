"""Everything the builders need about one chapter, fetched once.

Purpose
    The brief's performance rule is that a chapter's badges load WITH the
    chapter, not after a waterfall. That is a data-access shape before it is an
    HTTP shape: the repository gathers every table the five badges read in one
    round of queries, hands over this aggregate, and the builders then run
    against memory with no further I/O.

Why the aggregate lives in the domain
    The builders are pure functions and must be testable with no database and
    no application layer. They therefore need a type that neither imports.
    `application/ports.py` names this type in its Protocol; it does not own it.

Dependencies
    The record and provenance modules. Standard library otherwise. Rule 5.1.2.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field

from .provenance import SourceAttribution
from .records import (
    AlignedWordRecord,
    CrossRefRecord,
    DatedPassageRecord,
    EventRecord,
    PlaceMentionRecord,
    PlaceRecord,
    RouteRecord,
    RulerRecord,
    VerseText,
)


@dataclass(frozen=True, slots=True)
class ChapterBadgeData:
    """One chapter's badge inputs, as one value."""

    translation: str
    book_number: int
    chapter: int
    verses: tuple[VerseText, ...] = ()
    sources: Mapping[str, SourceAttribution] = field(default_factory=dict)
    places: Mapping[str, PlaceRecord] = field(default_factory=dict)
    mentions: tuple[PlaceMentionRecord, ...] = ()
    routes: tuple[RouteRecord, ...] = ()
    dated_passages: tuple[DatedPassageRecord, ...] = ()
    events: tuple[EventRecord, ...] = ()
    rulers: tuple[RulerRecord, ...] = ()
    words: tuple[AlignedWordRecord, ...] = ()
    cross_refs: tuple[CrossRefRecord, ...] = ()
    #: Verse lookup, built once. Frozen dataclasses may still populate a
    #: derived field in __post_init__, and a chapter is read far more often
    #: than it is built.
    _by_key: dict[int, VerseText] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        """Index the verses by key, once."""
        object.__setattr__(self, "_by_key", {verse.verse_key: verse for verse in self.verses})

    @property
    def is_empty(self) -> bool:
        """True when the chapter has no verses in this translation.

        Distinct from "has no badges": a chapter can exist and simply have no
        enrichment, which is a valid empty result, not an error.
        """
        return not self.verses

    def verse_text(self, verse_key: int) -> VerseText | None:
        """The verse a badge wants to anchor in, or None if not in range."""
        return self._by_key.get(verse_key)

    def source(self, source_key: str | None) -> SourceAttribution | None:
        """Resolve a source key to its attribution, or None.

        Returning None rather than raising is what makes AI-05 enforceable
        without a try/except in every builder: an unresolvable key produces a
        badge with an incomplete source tuple, and `InlineBadge.is_renderable`
        drops it.
        """
        if source_key is None:
            return None
        return self.sources.get(source_key)

    def sources_for(self, *source_keys: str | None) -> tuple[SourceAttribution, ...]:
        """Resolve several keys, de-duplicated, preserving order.

        An unresolvable key is deliberately NOT skipped -- it is dropped, which
        shortens the tuple, and a builder that required three sources and got
        two must then decide what to do. Builders check the length.
        """
        seen: dict[str, SourceAttribution] = {}
        for key in source_keys:
            attribution = self.source(key)
            if attribution is not None and attribution.key not in seen:
                seen[attribution.key] = attribution
        return tuple(seen.values())
