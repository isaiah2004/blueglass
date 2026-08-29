"""The Route badge: every place a passage names, in the order it names them.

Purpose
    A chapter's geography is context the reader cannot get from the page. This
    turns one `routes` row and its stops into a map that opens in place, and it
    is the only badge whose payload is a sequence rather than a single fact --
    which is exactly why what it may claim needs stating twice.

What the badge is allowed to claim
    Nothing about travel. `routes` at `scheme = 'chapter'` is derived by reading
    the place names out of the chapter in the order the text prints them
    (`ASSUMPTIONS.md`, the Route-badge-scope row). That derivation cannot tell a
    place somebody went to from a place somebody merely mentioned, and Acts 16
    contains three of the second kind in a row: the apostles' decisions were made
    at Jerusalem (16:4) but Paul does not go there; the Spirit refuses them
    Bithynia (16:7); Thyatira is named only as Lydia's home town (16:14). An
    earlier build titled that badge "Derbe to Thyatira - 20 stops on this
    journey", which asserted all three. No dataset in `data/raw/` supports it, so
    under `AI-05` and pillar 3 it is not said: the badge names *places named*, in
    mention order, and every word of its teaser, title and stat captions says so.

    The narrative roles -- departure, destination -- are therefore withheld under
    the chapter scheme and kept for a scheme that can actually establish them.

Why every waypoint is re-checked against the verse
    "16 places named in this chapter" is a sentence that is either true or a
    fabrication, and an earlier round shipped it while listing Greece in Acts 16
    -- a place the chapter never spells, recorded there because "a man of
    Macedonia" implies it. Nothing in the pipeline had ever compared a listed
    name against the chapter: `route_stops` is every located mention because
    `place_routes.py` cannot know which translation will be rendered, this
    builder filtered those stops only on having a coordinate, and the waypoint
    then printed `places.name` -- the gazetteer's headword, which for "Moreh 1"
    and "Negeb" is a string no translation contains. Measured over Acts 16,
    Acts 27, Genesis 12, Ruth 1 and Jonah 1, 10 of 49 listed names were absent
    from the chapter they were listed under.

    This builder is the first place that can decide it, because it is the first
    place that holds the verses. So the claim is derived from the thing it is a
    claim about:
    `spelling_in_verse` looks the place up in the verse the mention is recorded
    against, the waypoint is labelled with the words it found there, and a place
    the text does not name is not a waypoint. A stop that fails does not consume
    the place -- a later verse may still name it, and then that verse is where
    the badge says so.

Dependencies
    The badge domain only. Pure. Rule 5.1.2.
"""

from __future__ import annotations

from ..badge import BadgeId, InlineBadge
from ..badge_kind import BadgeKind
from ..camera import frame
from ..chapter_data import ChapterBadgeData
from ..payloads import LocationRole, MappedLocation, RoutePayload, VerseRange
from ..provenance import source_citation
from ..records import PlaceRecord, RouteRecord
from .place_support import (
    ANCHORABLE_MENTION,
    anchor_on_first_named,
    mapped_location,
    spelling_in_verse,
)

#: One place the chapter names: the verse that names it, the gazetteer row, and
#: the words that verse actually uses -- which is what the waypoint is labelled
#: with, because it is the only one of the three the reader can check.
NamedPlace = tuple[int, PlaceRecord, str]

#: A route is a chapter's spine: if the narrative moves, the movement IS the
#: context the reader is missing. It outranks everything else by construction.
_ROUTE_SCORE = 1.0

#: One pin is a site, not a map of a passage's geography; the 3D City badge
#: already covers that case, so a route needs at least two distinct places.
_MIN_PLACES = 2

#: How the badge names itself, per `routes.scheme`. Each is a statement about
#: what the text NAMES, never about what anyone travelled.
_SCHEME_NOUN = {"chapter": "this chapter"}

#: Wording for a scheme this build has not been taught.
_UNKNOWN_SCHEME_NOUN = "this passage"


def build_route_badges(data: ChapterBadgeData) -> list[InlineBadge]:
    """One badge per route whose first namable stop can be anchored."""
    built = [_route_badge(data, route) for route in data.routes]
    return [badge for badge in built if badge is not None]


def _route_badge(data: ChapterBadgeData, route: RouteRecord) -> InlineBadge | None:
    """Build one Route badge, or None when the chapter cannot carry it."""
    places = _named_places(data, route)
    if len(places) < _MIN_PLACES:
        return None
    anchored = anchor_on_first_named(data, [(key, place) for key, place, _ in places])
    if anchored is None:
        return None
    anchor = anchored[0]
    waypoints = _waypoints(places, route.scheme)
    camera = frame(tuple(point.coordinates for point in waypoints))
    if camera is None:
        return None
    sources = data.sources_for(route.source_key, *(place.source_key for _, place, _ in places))
    where = _SCHEME_NOUN.get(route.scheme, _UNKNOWN_SCHEME_NOUN)
    return InlineBadge(
        id=BadgeId(BadgeKind.ROUTE, anchor.verse_key, route.route_id),
        kind=BadgeKind.ROUTE,
        anchor=anchor,
        teaser=f"{len(waypoints)} places named in {where}",
        payload=RoutePayload(
            title=f"Places named in {where}",
            waypoints=waypoints,
            camera=camera,
            passage=VerseRange(route.start_key, route.end_key),
            scheme=route.scheme,
        ),
        sources=sources,
        citations=tuple(
            source_citation(f"route-{index}", "gazetteer", source)
            for index, source in enumerate(sources)
        ),
        rank_score=_ROUTE_SCORE,
    )


def _named_places(data: ChapterBadgeData, route: RouteRecord) -> list[NamedPlace]:
    """Every located place the passage's own text names, once each, in order.

    Three rules, and the badge's whole claim rests on them.

    Only an ANCHORABLE_MENTION counts. `route_stops` holds every located
    mention, because the loader cannot know which translation will be rendered;
    the other kinds mean the gazetteer's own survey of ten translations found
    the place referred to rather than named.

    That gate is about the MENTION, and it is not enough on its own. It let 45
    waypoints through labelled with a people or a person -- "Ammonites" x7,
    "Jews" x10, "Canaanite" at Numbers 33:40, and "Hadadezer", a man, pinned at
    Zobah -- because a mention whose kind is `name` can still be re-labelled by
    a demonym that the gazetteer files as one of the place's spellings. The
    second gate is `spellings.anchorable`, which decides which WORD may carry
    the claim; between them the canon-wide count of waypoints whose label
    disagrees with the place they mark falls from 1,170 to 292, and every one
    of the 292 is a translation spelling the sheet should print.

    Deduplicated across the WHOLE passage, not merely between neighbours. Acts 16
    names Mysia at 16:7 and again at 16:8, and Macedonia three times; drawing each
    repeat as its own pin put a 136-mile round trip to Mysia and a Macedonia
    triangle on the map, which reads as movement and is the one thing the mention
    order cannot establish. The first mention wins, because that is the verse the
    badge anchors on.

    Verified against the verse. A stop whose verse does not spell the place is
    skipped WITHOUT marking the place seen, so the first verse that does name it
    still gets to -- and a place no verse names is simply not in the list.
    """
    spelled_out = {
        (mention.verse_key, mention.place_id)
        for mention in data.mentions
        if mention.mention_kind == ANCHORABLE_MENTION
    }
    places: list[NamedPlace] = []
    seen: set[str] = set()
    for stop in sorted(route.stops, key=lambda item: item.position):
        place = data.places.get(stop.place_id)
        if place is None or not place.is_located or place.place_id in seen:
            continue
        if (stop.verse_key, stop.place_id) not in spelled_out:
            continue
        spelling = spelling_in_verse(data, stop.verse_key, place)
        if spelling is None:
            continue
        seen.add(place.place_id)
        places.append((stop.verse_key, place, spelling))
    return places


def _waypoints(places: list[NamedPlace], scheme: str) -> tuple[MappedLocation, ...]:
    """Turn named places into map pins, each with whatever role is established.

    The pin carries the spelling the verse used, never `places.name`: the sheet
    says these are the names the chapter prints, so they have to be. It also
    carries how many places share that name and how many sites are proposed for
    this one, because "Ramah" is nine different towns and the sheet may not
    pick one of them silently (DECISIONS #10).
    """
    last = len(places) - 1
    return tuple(
        mapped_location(place, spelling, verse_key, _role_at(index, last, place, scheme))
        for index, (verse_key, place, spelling) in enumerate(places)
    )


def _role_at(index: int, last: int, place: PlaceRecord, scheme: str) -> LocationRole:
    """The part a place plays, but only where the scheme can establish it.

    Under `scheme = 'chapter'` the order is the order the text prints the names,
    so the first place is not a departure and the last is not a destination --
    Acts 16 would call Thyatira, Lydia's home town, the end of a journey nobody
    made. Island is a fact about the place rather than about the passage, so it
    survives every scheme.
    """
    if place.feature_type == "island":
        return "island"
    if scheme == "chapter":
        return "waypoint"
    if index == 0:
        return "departure"
    if index == last:
        return "destination"
    return "waypoint"
