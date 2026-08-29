"""Derive an ordered sequence of places for a span of scripture.

Purpose
    The Route badge draws a journey: Troas -> Samothrace -> Neapolis ->
    Philippi. Nothing in any dataset publishes that ordering, and no model may
    invent it -- so it is DERIVED, from verse order and nothing else. Reading
    the order out of the text is the whole reason the badge can be trusted.

Key responsibilities
    - Group located place mentions into one route per chapter.
    - Order stops by verse and, within a verse, by position in the verse's own
      text -- see place_text_order. Acts 16:11 names Troas, Samothrace and
      Neapolis in that order; any other ordering sails the journey backwards.
    - Collapse a place mentioned twice in a row.
    - Refuse to emit a route with fewer than two stops, because one pin is a
      location, not a journey.

Scope
    scheme = 'chapter'. Hub question Q-024 asks whether routes should instead
    have waited for Murai's pericope boundaries; the passages table is empty
    today, so chapter granularity is what can be derived without blocking on
    another ingest. The scheme column lets passage-level routes land beside
    these rather than replacing them.

Dependencies
    The scripture domain's book table, for the OSIS code in a route id. No I/O.

Usage
    routes = derive_chapter_routes(mentions, located_ids, names_by_place)
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from app.modules.scripture.domain import NUMBER_TO_OSIS, split_verse_key
from scripts.place_rows import PlaceMentionRow
from scripts.place_text_order import WithinVerseOrder, alphabetical_only

#: A journey needs somewhere to leave from and somewhere to arrive at.
MINIMUM_STOPS = 2

#: The only scheme this module derives. Stored on every row it produces.
CHAPTER_SCHEME = "chapter"


@dataclass(frozen=True, slots=True)
class RouteStopRow:
    """One stop, at a position that came from the verse order."""

    position: int
    place_id: str
    verse_key: int


@dataclass(frozen=True, slots=True)
class RouteRow:
    """One derived route and its ordered stops."""

    route_id: str
    scheme: str
    book_number: int
    chapter: int
    start_key: int
    end_key: int
    stops: tuple[RouteStopRow, ...]

    @property
    def stop_count(self) -> int:
        """How many stops the route has. Always at least MINIMUM_STOPS."""
        return len(self.stops)


def route_id_for(book_number: int, chapter: int) -> str:
    """A readable, stable id: "chapter:Acts.16"."""
    return f"{CHAPTER_SCHEME}:{NUMBER_TO_OSIS[book_number]}.{chapter}"


def _ordered_mentions(
    mentions: Iterable[PlaceMentionRow],
    located: frozenset[str],
    names: Mapping[str, str],
    order: WithinVerseOrder,
) -> dict[int, list[PlaceMentionRow]]:
    """Group located mentions by chapter, each group in reading order.

    Verse number orders the chapter. Within one verse the text itself orders
    the places; a place the verse references without naming ranks last, and the
    place name breaks any remaining tie so two runs over the same bytes produce
    the same route.
    """
    grouped: dict[int, list[PlaceMentionRow]] = {}
    for mention in mentions:
        if mention.place_id in located:
            grouped.setdefault(mention.verse_key // 1000, []).append(mention)
    for group in grouped.values():
        group.sort(
            key=lambda row: (
                row.verse_key,
                order.rank(row.verse_key, row.place_id),
                names.get(row.place_id, ""),
                row.place_id,
            )
        )
    return grouped


def _collapse(group: list[PlaceMentionRow]) -> list[PlaceMentionRow]:
    """Drop a place immediately repeated: standing still is not a leg."""
    collapsed: list[PlaceMentionRow] = []
    for mention in group:
        if not collapsed or collapsed[-1].place_id != mention.place_id:
            collapsed.append(mention)
    return collapsed


def _route_from(group: list[PlaceMentionRow]) -> RouteRow | None:
    """Build one route from one chapter's ordered mentions, or None."""
    stops = _collapse(group)
    if len(stops) < MINIMUM_STOPS:
        return None
    book_number, chapter, _ = split_verse_key(stops[0].verse_key)
    return RouteRow(
        route_id=route_id_for(book_number, chapter),
        scheme=CHAPTER_SCHEME,
        book_number=book_number,
        chapter=chapter,
        start_key=min(stop.verse_key for stop in stops),
        end_key=max(stop.verse_key for stop in stops),
        stops=tuple(
            RouteStopRow(position, stop.place_id, stop.verse_key)
            for position, stop in enumerate(stops, start=1)
        ),
    )


def derive_chapter_routes(
    mentions: Iterable[PlaceMentionRow],
    located: frozenset[str],
    names: Mapping[str, str],
    order: WithinVerseOrder | None = None,
) -> tuple[RouteRow, ...]:
    """Every chapter route the mentions support, in canonical order.

    Only places with a coordinate become stops. An unlocated place is not a
    hole in the route -- it is a place nobody can draw, and drawing a line
    through where it might have been is exactly the fabrication the 41 km
    coordinate-error finding rules out.
    """
    grouped = _ordered_mentions(
        mentions, located, names, order if order is not None else alphabetical_only()
    )
    routes = [
        route
        for _, group in sorted(grouped.items())
        if (route := _route_from(group)) is not None
    ]
    return tuple(routes)
