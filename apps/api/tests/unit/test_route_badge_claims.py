"""What the Route badge is allowed to say, pinned against what it once said.

The defect these tests exist for was found by reading the shipped reader beside
the chapter it was annotating. Acts 16 produced:

    "Derbe to Thyatira - 20 stops on this journey"

with a numbered leg list and a polyline through all twenty. Three of those
twenty contradict the visible text: Jerusalem is where the decisions were made
(16:4) and Paul does not go there; the Spirit refuses them Bithynia (16:7);
Thyatira is Lydia's home town (16:14), not a destination. Mysia was drawn twice,
so the map also showed a 136-mile round trip nobody took.

`routes` at `scheme = 'chapter'` is derived by reading place names out of the
chapter in mention order. That derivation cannot distinguish a place travelled
through from a place merely named, so under `AI-05` the badge may not claim the
distinction -- in its teaser, its title, its pin roles, or its geometry.
"""

from __future__ import annotations

from app.modules.badges.domain import (
    ChapterBadgeData,
    PlaceRecord,
    RouteRecord,
    RouteStopRecord,
    SourceAttribution,
    VerseText,
    build_route_badges,
)

GAZETTEER = SourceAttribution(
    key="openbible_geocoding",
    name="OpenBible.info Bible Geocoding Data",
    licence="CC-BY-4.0",
    attribution="Place data (c) OpenBible.info, CC BY 4.0",
    share_alike=False,
)

#: Acts 16:7-8 in the BSB, which names Mysia twice and Bithynia once.
VERSES = (
    VerseText(
        verse_key=44016007,
        verse=7,
        osis_id="Acts.16.7",
        text="They tried to enter Bithynia, but the Spirit of Jesus would not permit them.",
    ),
    VerseText(
        verse_key=44016008,
        verse=8,
        osis_id="Acts.16.8",
        text="So they passed by Mysia and went down to Troas.",
    ),
)


def _place(place_id: str, name: str, lng: float, lat: float) -> PlaceRecord:
    """A located place whose one spelling is its name."""
    return PlaceRecord(
        place_id=place_id,
        name=name,
        modern_name=None,
        lat=lat,
        lng=lng,
        feature_type="region" if name in {"Mysia", "Bithynia"} else "settlement",
        verse_count=4,
        candidate_count=1,
        precision_type="site",
        source_key=GAZETTEER.key,
        spellings=frozenset({name.lower()}),
    )


PLACES = {
    "mysia": _place("mysia", "Mysia", 27.9, 39.6),
    "bithynia": _place("bithynia", "Bithynia", 30.5, 40.6),
    "troas": _place("troas", "Troas", 26.16, 39.75),
}

#: Mysia is named at 16:7 (the "tried to enter Bithynia" verse names it too in
#: the wider passage) and again at 16:8, which is the repeat that used to be
#: drawn as a round trip.
ROUTE = RouteRecord(
    route_id="chapter:Acts.16",
    scheme="chapter",
    start_key=44016007,
    end_key=44016008,
    source_key=GAZETTEER.key,
    stops=(
        RouteStopRecord(position=1, verse_key=44016007, place_id="bithynia"),
        RouteStopRecord(position=2, verse_key=44016008, place_id="mysia"),
        RouteStopRecord(position=3, verse_key=44016008, place_id="troas"),
        RouteStopRecord(position=4, verse_key=44016008, place_id="mysia"),
    ),
)

CHAPTER = ChapterBadgeData(
    translation="BSB",
    book_number=44,
    chapter=16,
    verses=VERSES,
    sources={GAZETTEER.key: GAZETTEER},
    places=PLACES,
    routes=(ROUTE,),
)


def _route_badge() -> object:
    """The single badge Acts 16's fragment produces."""
    badges = build_route_badges(CHAPTER)
    assert len(badges) == 1
    return badges[0]


class TestTheClaimTheTeaserMakes:
    """The teaser is the only sentence most readers ever see about a badge."""

    def test_it_never_calls_the_places_stops_on_a_journey(self) -> None:
        teaser = _route_badge().teaser  # type: ignore[attr-defined]

        assert "journey" not in teaser.lower()
        assert "stop" not in teaser.lower()

    def test_it_counts_places_named_and_says_where_they_were_named(self) -> None:
        assert _route_badge().teaser == "3 places named in this chapter"  # type: ignore[attr-defined]

    def test_the_title_does_not_run_from_a_first_place_to_a_last_one(self) -> None:
        title = _route_badge().payload.title  # type: ignore[attr-defined]

        assert title == "Places named in this chapter"
        assert " to " not in title


class TestTheGeometryTheMapDraws:
    """A repeat in the text is not a return in the world."""

    def test_a_place_named_twice_is_drawn_once(self) -> None:
        waypoints = _route_badge().payload.waypoints  # type: ignore[attr-defined]
        names = [point.name for point in waypoints]

        assert names.count("Mysia") == 1
        assert names == ["Bithynia", "Mysia", "Troas"]

    def test_the_pin_kept_is_the_first_mention_the_badge_anchors_on(self) -> None:
        waypoints = _route_badge().payload.waypoints  # type: ignore[attr-defined]
        mysia = next(point for point in waypoints if point.name == "Mysia")

        assert mysia.verse_key == 44016008


class TestTheRolesThePayloadAsserts:
    """Departure and destination are claims the chapter scheme cannot support."""

    def test_no_place_is_called_a_departure_or_a_destination(self) -> None:
        roles = {point.role for point in _route_badge().payload.waypoints}  # type: ignore[attr-defined]

        assert roles == {"waypoint"}

    def test_a_scheme_that_can_establish_them_still_gets_them(self) -> None:
        passage_route = RouteRecord(
            route_id="pericope:Acts.16.6-10",
            scheme="pericope",
            start_key=ROUTE.start_key,
            end_key=ROUTE.end_key,
            source_key=ROUTE.source_key,
            stops=ROUTE.stops,
        )
        badges = build_route_badges(
            ChapterBadgeData(
                translation="BSB",
                book_number=44,
                chapter=16,
                verses=VERSES,
                sources={GAZETTEER.key: GAZETTEER},
                places=PLACES,
                routes=(passage_route,),
            )
        )

        roles = [point.role for point in badges[0].payload.waypoints]
        assert roles == ["departure", "waypoint", "destination"]
        assert badges[0].payload.title == "Places named in this passage"
