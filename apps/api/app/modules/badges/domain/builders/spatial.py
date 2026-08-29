"""The two spatial badges: Route and 3D City.

Purpose
    Both read the gazetteer and both anchor on a place name found in the verse,
    so they sit together and share `place_support`. What differs is the claim:
    Route is about every place a passage names, 3D City is about one of them.

What the Route badge is allowed to claim
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

The 3D City honesty note
    `dataset-validation.md` 4.3 is a confirmed negative: no openly-licensed 3D
    reconstruction of any biblical city exists, and the nearest candidate is
    CC BY-NC-ND, which fails twice over. So this badge ships the SITE, not a
    reconstruction -- the pin, the modern identification, how many
    identifications scholarship actually offers, and where the chapter names
    it. Every one of those is a column of `places` carrying OpenBible's licence.
    Nothing is invented, and `has_reconstruction` is False, which is the truth.

Dependencies
    The badge domain only. Pure. Rule 5.1.2.
"""

from __future__ import annotations

import math

from ..badge import BadgeId, InlineBadge
from ..badge_kind import BadgeKind
from ..camera import frame
from ..chapter_data import ChapterBadgeData
from ..payloads import (
    City3dPayload,
    LocationRole,
    MappedLocation,
    RoutePayload,
    VerseRange,
)
from ..provenance import source_citation
from ..records import PlaceRecord, RouteRecord
from .place_support import (
    ANCHORABLE_MENTION,
    CITY_FEATURE,
    anchor_on_first_named,
    coordinates_of,
    named_mentions_of,
)

#: A route is a chapter's spine: if the narrative moves, the movement IS the
#: context the reader is missing. It outranks everything else by construction.
_ROUTE_SCORE = 1.0

#: Scales `canon_verse_count` into the 3D City score. 200 verses is roughly
#: Jerusalem's order of magnitude; the log stops a five-verse town scoring
#: forty times below a capital when it is not forty times less interesting.
_CITY_SCALE = math.log10(201.0)
_CITY_FLOOR = 0.35
_CITY_RANGE = 0.45

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
    anchored = anchor_on_first_named(data, places)
    if anchored is None:
        return None
    anchor = anchored[0]
    waypoints = _waypoints(places, route.scheme)
    camera = frame(tuple(point.coordinates for point in waypoints))
    if camera is None:
        return None
    sources = data.sources_for(route.source_key, *(place.source_key for _, place in places))
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


def _named_places(
    data: ChapterBadgeData, route: RouteRecord
) -> list[tuple[int, PlaceRecord]]:
    """Every located place the passage names, once each, in mention order.

    Deduplicated across the WHOLE passage, not merely between neighbours. Acts 16
    names Mysia at 16:7 and again at 16:8, and Macedonia three times; drawing each
    repeat as its own pin put a 136-mile round trip to Mysia and a Macedonia
    triangle on the map, which reads as movement and is the one thing the mention
    order cannot establish. The first mention wins, because that is the verse the
    badge anchors on.
    """
    places: list[tuple[int, PlaceRecord]] = []
    seen: set[str] = set()
    for stop in sorted(route.stops, key=lambda item: item.position):
        place = data.places.get(stop.place_id)
        if place is None or not place.is_located or place.place_id in seen:
            continue
        seen.add(place.place_id)
        places.append((stop.verse_key, place))
    return places


def _waypoints(
    places: list[tuple[int, PlaceRecord]], scheme: str
) -> tuple[MappedLocation, ...]:
    """Turn located places into map pins, each with whatever role is established."""
    last = len(places) - 1
    return tuple(
        MappedLocation(
            name=place.name,
            coordinates=coordinates_of(place),
            role=_role_at(index, last, place, scheme),
            feature_type=place.feature_type,
            place_id=place.place_id,
            verse_key=verse_key,
        )
        for index, (verse_key, place) in enumerate(places)
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


def build_city_badges(data: ChapterBadgeData) -> list[InlineBadge]:
    """One badge per located settlement the chapter names by name."""
    built = [_city_badge(data, place_id) for place_id in _named_settlements(data)]
    return [badge for badge in built if badge is not None]


def _named_settlements(data: ChapterBadgeData) -> list[str]:
    """Distinct settlement ids, in order of first mention in the chapter."""
    ordered: list[str] = []
    for mention in sorted(data.mentions, key=lambda item: (item.verse_key, item.place_id)):
        place = data.places.get(mention.place_id)
        if place is None or place.place_id in ordered:
            continue
        if mention.mention_kind != ANCHORABLE_MENTION:
            continue
        if place.feature_type != CITY_FEATURE or not place.is_located:
            continue
        ordered.append(place.place_id)
    return ordered


def _city_badge(data: ChapterBadgeData, place_id: str) -> InlineBadge | None:
    """Build one 3D City badge, anchored on its first spelling in the chapter."""
    place = data.places[place_id]
    anchored = anchor_on_first_named(data, named_mentions_of(data, place_id))
    if anchored is None:
        return None
    anchor = anchored[0]
    sources = data.sources_for(place.source_key)
    return InlineBadge(
        id=BadgeId(BadgeKind.CITY_3D, anchor.verse_key, place.place_id),
        kind=BadgeKind.CITY_3D,
        anchor=anchor,
        teaser=_city_teaser(place),
        payload=City3dPayload(
            location=MappedLocation(
                name=place.name,
                coordinates=coordinates_of(place),
                role="waypoint",
                feature_type=place.feature_type,
                place_id=place.place_id,
                verse_key=anchor.verse_key,
            ),
            modern_name=place.modern_name,
            identification_count=place.candidate_count,
            precision_type=place.precision_type,
            canon_verse_count=place.verse_count,
            mentioned_at=_mention_osis(data, place_id),
        ),
        sources=sources,
        citations=tuple(
            source_citation(f"city-{index}", "gazetteer", source)
            for index, source in enumerate(sources)
        ),
        rank_score=_city_score(place),
    )


def _mention_osis(data: ChapterBadgeData, place_id: str) -> tuple[str, ...]:
    """OSIS ids of this chapter's mentions, for the sheet's "named here" list."""
    verses = [data.verse_text(key) for key, _ in named_mentions_of(data, place_id)]
    return tuple(verse.osis_id for verse in verses if verse is not None)


def _renames_the_place(place: PlaceRecord) -> bool:
    """True when the modern name actually tells the reader something new.

    "Jerusalem - today Jerusalem" is a sentence that says nothing, and it was
    shown both inline in the chapter summary and as the sheet's headline claim.
    The gazetteer stores the modern identification for every located place,
    including the many whose name never changed, so the teaser has to ask
    whether the identification is news before it prints it as news.

    Compared case-folded and stripped, because the difference between
    "Jerusalem" and "jerusalem " is a data-entry artefact and not a rename.
    """
    modern = (place.modern_name or "").strip()
    return bool(modern) and modern.casefold() != place.name.strip().casefold()


def _city_teaser(place: PlaceRecord) -> str:
    """One line for the chapter summary list.

    Scholarly disagreement leads when it exists: 777 of 1,342 ancient places
    have more than one candidate modern site, and DECISIONS #10 forbids
    collapsing that to a single confident pin. A real rename comes next,
    because "today Tel Lystra" is the fact a reader cannot supply themselves.
    Where the name never changed there is no such fact, so the teaser falls
    back to how much of the canon names the place -- which is the other thing
    the gazetteer knows and the one that separates Jerusalem from Derbe.
    """
    if place.candidate_count > 1:
        return f"{place.name} - {place.candidate_count} proposed sites for this city"
    if _renames_the_place(place):
        return f"{place.name} - today {place.modern_name}"
    verses = "verse" if place.verse_count == 1 else "verses"
    return f"{place.name} - named in {place.verse_count} {verses} of scripture"


def _city_score(place: PlaceRecord) -> float:
    """How much a reader gains from this site, by how often scripture names it."""
    weight = min(1.0, math.log10(1.0 + place.verse_count) / _CITY_SCALE)
    return round(_CITY_FLOOR + _CITY_RANGE * weight, 4)
