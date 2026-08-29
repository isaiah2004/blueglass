"""Postgres implementation of the BadgeRepository port.

Purpose
    Load, in one pass, everything the five M2 badges are built from. Nothing
    here decides what a badge is worth or how many a chapter gets -- those are
    domain rules and live in `domain/`.

The performance shape
    The brief's rule is that a chapter's badges arrive WITH the chapter rather
    than after a waterfall. A waterfall is a chain of round trips the CLIENT
    makes, and there is none: one HTTP call returns fully-formed badges. Inside
    the service the cost is bounded three ways:

      * ONE pool acquire for the whole chapter. The ten statements then run
        back to back on that connection. They are deliberately not gathered:
        asyncpg serialises operations on a single connection and raises if two
        overlap, and taking ten connections from a pool whose default ceiling
        is ten would trade a few milliseconds for a pool exhausted by a single
        request.
      * The statement that could return thousands of rows is bounded in SQL.
        Cross-references are trimmed per verse by a window function using the
        domain's own constants, so at most six rows per verse cross the wire
        instead of about twenty-five.
      * Every statement rides an index the ingest migrations already created;
        `badge_sql.py` names which one.

Dependencies
    asyncpg via the shared Database wrapper, the badge domain, the scripture
    domain's verse-key arithmetic. Implements `application/ports.py`.

Usage
    repository = PostgresBadgeRepository(database)
"""

from __future__ import annotations

from collections.abc import Sequence

import asyncpg

from ....infrastructure.db import Database
from ..domain import ChapterBadgeData, RouteRecord, RouteStopRecord
from ..domain.builders.crossref import MAX_TARGETS, MIN_VOTES
from . import badge_sql as sql
from . import row_mappers as mappers

#: verse_key encoding: book * 1_000_000 + chapter * 1_000 + verse.
_BOOK_FACTOR = 1_000_000
_CHAPTER_FACTOR = 1_000
_MAX_VERSE = 999


class PostgresBadgeRepository:
    """Reads every badge input for one chapter from Postgres."""

    def __init__(self, database: Database) -> None:
        self._db = database

    async def load_chapter(
        self, *, translation: str, book_number: int, chapter: int
    ) -> ChapterBadgeData:
        """Every badge input for one chapter, in one round of queries."""
        first, last = _chapter_range(book_number, chapter)
        async with self._db.acquire() as connection:
            results = [
                await connection.fetch(query, *args)
                for query, args in _statements(translation, book_number, chapter, first, last)
            ]
        return _assemble(translation, book_number, chapter, results)


def _statements(
    translation: str, book_number: int, chapter: int, first: int, last: int
) -> tuple[tuple[str, tuple[object, ...]], ...]:
    """The ten reads, in the order `_assemble` unpacks them.

    Pairing each statement with its arguments here rather than inline keeps the
    loading method short enough to read in one glance, and makes the order --
    which `_assemble` depends on -- a single, visible list.
    """
    return (
        (sql.CHAPTER_VERSES, (translation, book_number, chapter)),
        (sql.DATA_SOURCES, ()),
        (sql.PLACE_MENTIONS, (first, last)),
        (sql.CHAPTER_PLACES, (first, last, book_number, chapter)),
        (sql.CHAPTER_ROUTES, (book_number, chapter)),
        (sql.DATED_PASSAGES, (first, last)),
        (sql.BOOK_EVENTS, (book_number,)),
        (sql.RULERS, ()),
        (sql.CHAPTER_WORDS, (translation, first, last)),
        (sql.CHAPTER_CROSS_REFS, (translation, first, last, MIN_VOTES, MAX_TARGETS)),
    )


def _chapter_range(book_number: int, chapter: int) -> tuple[int, int]:
    """The first and last verse key a chapter can hold.

    Bounding the range rather than joining on (book, chapter) is what lets the
    enrichment tables stay verse-keyed: `place_mentions`, `cross_references`
    and `verse_word_alignments` all carry only `verse_key`, and a BETWEEN over
    it uses their existing indexes.
    """
    base = book_number * _BOOK_FACTOR + chapter * _CHAPTER_FACTOR
    return (base + 1, base + _MAX_VERSE)


def _assemble(
    translation: str,
    book_number: int,
    chapter: int,
    results: Sequence[Sequence[asyncpg.Record]],
) -> ChapterBadgeData:
    """Map ten result sets onto the aggregate the builders consume."""
    verses, sources, mentions, places, routes, dated, events, rulers, words, xrefs = results
    return ChapterBadgeData(
        translation=translation,
        book_number=book_number,
        chapter=chapter,
        verses=tuple(mappers.to_verse(row) for row in verses),
        sources={row["key"]: mappers.to_source(row) for row in sources},
        places={row["place_id"]: mappers.to_place(row) for row in places},
        mentions=tuple(mappers.to_place_mention(row) for row in mentions),
        routes=_to_routes(routes),
        dated_passages=tuple(mappers.to_dated_passage(row) for row in dated),
        events=tuple(mappers.to_event(row) for row in events),
        rulers=tuple(mappers.to_ruler(row) for row in rulers),
        words=tuple(mappers.to_aligned_word(row) for row in words),
        cross_refs=tuple(mappers.to_cross_ref(row) for row in xrefs),
    )


def _to_routes(rows: Sequence[asyncpg.Record]) -> tuple[RouteRecord, ...]:
    """Fold the flat route-and-stops join back into nested routes.

    One query rather than two: a route without its stops is useless, and the
    join is small enough (twenty rows for Acts 16) that the repetition of the
    route columns costs less than a second round trip.
    """
    heads: dict[str, asyncpg.Record] = {}
    stops: dict[str, list[RouteStopRecord]] = {}
    for row in rows:
        route_id = row["route_id"]
        heads.setdefault(route_id, row)
        stops.setdefault(route_id, []).append(
            RouteStopRecord(
                position=row["position"],
                verse_key=row["verse_key"],
                place_id=row["place_id"],
            )
        )
    return tuple(
        RouteRecord(
            route_id=route_id,
            scheme=heads[route_id]["scheme"],
            start_key=heads[route_id]["start_key"],
            end_key=heads[route_id]["end_key"],
            source_key=heads[route_id]["source_key"],
            stops=tuple(sorted(stops[route_id], key=lambda stop: stop.position)),
        )
        for route_id in sorted(heads)
    )
