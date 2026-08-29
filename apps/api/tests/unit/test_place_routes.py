"""Route order comes from the text, never from a model.

The worked example is Acts 16:11-12 -- Troas, Samothrace, Neapolis, Philippi.
All three of the first leg's places are named in one verse, so a route ordered
by anything but the verse's own wording sails the voyage backwards.
"""

from __future__ import annotations

from scripts.place_routes import derive_chapter_routes, route_id_for
from scripts.place_rows import PlaceMentionRow
from scripts.place_text_order import NOT_IN_TEXT, WithinVerseOrder, alphabetical_only

ACTS_16_11 = 44_016_011
ACTS_16_12 = 44_016_012

NAMES = {
    "troas": "Troas",
    "samo": "Samothrace",
    "neap": "Neapolis",
    "phil": "Philippi",
    "maced": "Macedonia",
}
LOCATED = frozenset(NAMES)

TEXTS = {
    ACTS_16_11: (
        "We sailed from Troas straight to Samothrace, and the following day on to Neapolis."
    ),
    ACTS_16_12: (
        "From there we went to the Roman colony of Philippi, the leading city "
        "of that district of Macedonia."
    ),
}
SPELLINGS = {place_id: [name] for place_id, name in NAMES.items()}


def _mentions(*pairs: tuple[int, str]) -> list[PlaceMentionRow]:
    return [
        PlaceMentionRow(place_id, verse_key, "Acts.16", "name")
        for verse_key, place_id in pairs
    ]


def _voyage() -> list[PlaceMentionRow]:
    return _mentions(
        (ACTS_16_11, "neap"),
        (ACTS_16_11, "samo"),
        (ACTS_16_11, "troas"),
        (ACTS_16_12, "maced"),
        (ACTS_16_12, "phil"),
    )


def _names_of(route_stops: object) -> list[str]:
    return [NAMES[stop.place_id] for stop in route_stops]  # type: ignore[attr-defined]


def test_the_text_orders_places_that_share_a_verse() -> None:
    order = WithinVerseOrder(TEXTS, SPELLINGS)

    (route,) = derive_chapter_routes(_voyage(), LOCATED, NAMES, order)

    assert _names_of(route.stops) == [
        "Troas",
        "Samothrace",
        "Neapolis",
        "Philippi",
        "Macedonia",
    ]


def test_without_the_text_the_same_verse_falls_back_to_alphabetical() -> None:
    """Which is the voyage in reverse -- the reason the loader refuses to run
    when no verses are loaded."""
    (route,) = derive_chapter_routes(_voyage(), LOCATED, NAMES, alphabetical_only())

    assert _names_of(route.stops)[:3] == ["Neapolis", "Samothrace", "Troas"]


def test_a_route_carries_its_span_and_a_readable_id() -> None:
    (route,) = derive_chapter_routes(
        _voyage(), LOCATED, NAMES, WithinVerseOrder(TEXTS, SPELLINGS)
    )

    assert route.route_id == route_id_for(44, 16) == "chapter:Acts.16"
    assert (route.book_number, route.chapter) == (44, 16)
    assert (route.start_key, route.end_key) == (ACTS_16_11, ACTS_16_12)
    assert route.stop_count == 5
    assert [stop.position for stop in route.stops] == [1, 2, 3, 4, 5]


def test_a_place_repeated_in_the_next_verse_is_collapsed() -> None:
    """Standing still is not a leg of a journey."""
    mentions = _mentions((ACTS_16_11, "troas"), (ACTS_16_12, "troas"), (44_016_013, "phil"))

    (route,) = derive_chapter_routes(mentions, LOCATED, NAMES, alphabetical_only())

    assert _names_of(route.stops) == ["Troas", "Philippi"]


def test_a_chapter_with_one_place_produces_no_route() -> None:
    """One pin is a location, not a journey."""
    mentions = _mentions((ACTS_16_11, "troas"), (ACTS_16_12, "troas"))

    assert derive_chapter_routes(mentions, LOCATED, NAMES, alphabetical_only()) == ()


def test_an_unlocated_place_never_becomes_a_stop() -> None:
    """Drawing a line through where a place might have been is the fabrication
    the 41 km coordinate-error finding rules out."""
    located = LOCATED - {"maced"}

    (route,) = derive_chapter_routes(
        _voyage(), located, NAMES, WithinVerseOrder(TEXTS, SPELLINGS)
    )

    assert "Macedonia" not in _names_of(route.stops)


def test_a_place_the_verse_does_not_name_ranks_last() -> None:
    order = WithinVerseOrder(TEXTS, SPELLINGS)

    assert order.rank(ACTS_16_11, "phil") == NOT_IN_TEXT
    assert order.rank(ACTS_16_11, "troas") < NOT_IN_TEXT


def test_a_name_inside_a_longer_word_is_not_a_match() -> None:
    """Without word boundaries "Asia" matches inside "Asiarch"."""
    order = WithinVerseOrder({ACTS_16_11: "the Asiarchs sent word"}, {"asia": ["Asia"]})

    assert order.rank(ACTS_16_11, "asia") == NOT_IN_TEXT


def test_the_order_reports_how_much_of_the_text_it_matched() -> None:
    order = WithinVerseOrder(TEXTS, SPELLINGS)
    order.rank(ACTS_16_11, "troas")
    order.rank(ACTS_16_11, "phil")

    assert (order.matched, order.considered) == (1, 2)
    assert order.match_rate == 0.5


def test_chapters_come_back_in_canonical_order() -> None:
    mentions = _mentions(
        (45_001_001, "troas"),
        (45_001_002, "phil"),
        (ACTS_16_11, "troas"),
        (ACTS_16_12, "phil"),
    )

    routes = derive_chapter_routes(mentions, LOCATED, NAMES, alphabetical_only())

    assert [route.route_id for route in routes] == ["chapter:Acts.16", "chapter:Rom.1"]
