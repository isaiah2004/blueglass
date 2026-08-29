"""Every place the Route badge lists is named in the chapter it lists it under.

Against real Postgres and the real BSB text, because that is the only place the
claim can actually be false. The unit tests beside this one pin the three causes
with fixtures; this one asks the shipped pipeline the question the sheet asks
the reader to trust: "N places named in this chapter · Listed in the order this
chapter names them".

Measured before the fix, over the five chapters below: 49 names listed, 10 of
them absent from the chapter -- Greece (Acts 16), Adramyttium and Alexandria
(Acts 27), "Moreh 1", "Bethel 1", "Ai 1" and "Negeb" (Genesis 12), "Bethlehem 1"
and "Moab 1" (Ruth 1), "Tarshish 1" (Jonah 1).

Set ATLAS_TEST_DATABASE_URL to run. Inside the compose stack:

    docker compose exec -e ATLAS_TEST_DATABASE_URL=$DATABASE_URL api \
        python -m pytest tests/integration/test_route_names_live.py
"""

from __future__ import annotations

import re
import unicodedata

import asyncpg
import pytest

from app.modules.badges.domain import (
    ChapterBadgeData,
    MappedLocation,
    names_a_people,
    normalise_name,
)
from app.modules.badges.infrastructure.postgres_badge_repository import (
    _assemble,
    _chapter_range,
    _statements,
)

pytestmark = pytest.mark.integration

TRANSLATION = "BSB"

#: The five chapters the defect was reported and measured on, plus the four
#: densest routes in the canon -- Joshua's tribal boundary lists, which name
#: more places per chapter than anything else and are where a matcher that is
#: too loose will show it first.
CHAPTERS: tuple[tuple[str, int, int], ...] = (
    ("Acts 16", 44, 16),
    ("Acts 27", 44, 27),
    ("Genesis 12", 1, 12),
    ("Ruth 1", 8, 1),
    ("Jonah 1", 32, 1),
    ("Joshua 15", 6, 15),
    ("Joshua 19", 6, 19),
    ("Joshua 10", 6, 10),
    ("Numbers 33", 4, 33),
)

_ALL_ROUTES = "SELECT route_id FROM routes"

#: Measured across all 682 derived routes after the spelling gates landed: 632
#: badges, 4,298 names, none unsupported, none a people-word, none another
#: place's published name, and 1,122 of them on a name two to nine places
#: share. Set 5% below, so ordinary gazetteer movement does not fail the build
#: while a change that guts the badge still does.
MINIMUM_NAMES_IN_THE_CANON = 4_083

#: Every string some place publishes as its own name, and which places publish
#: it. A waypoint label that resolves to a DIFFERENT place than the pin it sits
#: on is the Ezekiel 26:7 defect: Babylon's coordinate under the label "Tyre".
_PUBLISHED_NAMES = """
    SELECT normalised, array_agg(place_id) AS place_ids
      FROM place_names WHERE kind = 'primary' GROUP BY normalised
"""


def _fold(value: str) -> str:
    """Case- and accent-blind form, for comparing a label with a verse."""
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _names_in(text: str, name: str) -> bool:
    """Does `text` spell `name`, on word boundaries?

    Deliberately independent of the matcher under test: reusing
    `spelling_in_verse` here would prove only that it agrees with itself.
    """
    return re.search(rf"(?<!\w){re.escape(_fold(name))}(?!\w)", _fold(text)) is not None


async def _load(connection: asyncpg.Connection, book: int, chapter: int) -> ChapterBadgeData:
    """One chapter's badge inputs, through the repository's own SQL."""
    first, last = _chapter_range(book, chapter)
    results = [
        await connection.fetch(query, *args)
        for query, args in _statements(TRANSLATION, book, chapter, first, last)
    ]
    return _assemble(TRANSLATION, book, chapter, results)


def _route_waypoints(data: ChapterBadgeData) -> list[tuple[str, int]]:
    """Every (name, verse_key) a Route badge would print for this chapter."""
    return [(point.name, point.verse_key) for point in _route_pins(data)]


def _route_pins(data: ChapterBadgeData) -> list[MappedLocation]:
    """Every pin a Route badge would draw for this chapter."""
    from app.modules.badges.domain.builders import build_route_badges

    return [point for badge in build_route_badges(data) for point in badge.payload.waypoints]


async def _unsupported(
    connection: asyncpg.Connection, book: int, chapter: int
) -> tuple[list[str], int]:
    """Names the chapter does not spell, and how many were listed in total."""
    data = await _load(connection, book, chapter)
    if data.is_empty:
        pytest.skip("Scripture is not loaded; run scripts.load_scripture BSB.")
    chapter_text = " ".join(verse.text for verse in data.verses)
    listed = _route_waypoints(data)
    return ([name for name, _ in listed if not _names_in(chapter_text, name)], len(listed))


_IDS = [row[0] for row in CHAPTERS]


@pytest.mark.parametrize(("label", "book", "chapter"), CHAPTERS, ids=_IDS)
async def test_every_listed_place_is_named_in_the_chapter(
    connection: asyncpg.Connection, label: str, book: int, chapter: int
) -> None:
    """The invariant. A name with no textual support is a fabricated claim."""
    unsupported, listed = await _unsupported(connection, book, chapter)

    assert unsupported == [], f"{label} lists {len(unsupported)} of {listed} unsupported"


@pytest.mark.parametrize(("label", "book", "chapter"), CHAPTERS, ids=_IDS)
async def test_every_listed_place_is_named_in_its_own_verse(
    connection: asyncpg.Connection, label: str, book: int, chapter: int
) -> None:
    """The sheet prints a verse beside each place, so that has to hold too."""
    data = await _load(connection, book, chapter)
    if data.is_empty:
        pytest.skip("Scripture is not loaded; run scripts.load_scripture BSB.")

    for name, verse_key in _route_waypoints(data):
        verse = data.verse_text(verse_key)
        assert verse is not None, f"{label}: {name} cites verse {verse_key}, not in chapter"
        assert _names_in(verse.text, name), f"{label}: {verse.osis_id} does not name {name}"


async def test_the_five_reported_chapters_still_list_the_places_they_do_name(
    connection: asyncpg.Connection,
) -> None:
    """The fix must not be "list nothing". Counts measured after the fix.

    Acts 16 keeps 15 of its 16 (Greece goes), Acts 27 keeps 18 of 20, and the
    other three keep every place -- what changed there is the label, from a
    gazetteer headword to the words the chapter prints.

    Acts 27 lost a second place when the spelling gates landed, and the loss is
    the point. Acts 27:2 reads "an Adramyttian ship" and 27:6 reads "an
    Alexandrian ship" -- the same English construction, naming no place -- yet
    only the second was dropped, because OpenBible classifies the first mention
    as `name` and the second as `people_group`. The chapter decided which of
    two identical sentences got a pin. Now neither does: "Adramyttian" is a
    people-word, and `spellings.anchorable` refuses it whatever the mention
    kind says.
    """
    kept = {}
    for label, book, chapter in CHAPTERS[:5]:
        data = await _load(connection, book, chapter)
        if data.is_empty:
            pytest.skip("Scripture is not loaded; run scripts.load_scripture BSB.")
        kept[label] = len(_route_waypoints(data))

    assert kept == {
        "Acts 16": 15,
        "Acts 27": 18,
        "Genesis 12": 8,
        "Ruth 1": 2,
        "Jonah 1": 3,
    }


async def test_no_route_in_the_canon_lists_a_place_its_chapter_does_not_name(
    connection: asyncpg.Connection,
) -> None:
    """The sweep. Every derived route, not a sample of them."""
    route_ids = [row["route_id"] for row in await connection.fetch(_ALL_ROUTES)]
    if not route_ids:
        pytest.skip("The gazetteer is not loaded; run scripts.ingest_places.")

    offences: list[str] = []
    listed = 0
    for route_id in route_ids:
        book, chapter = _book_and_chapter(route_id)
        unsupported, count = await _unsupported(connection, book, chapter)
        offences.extend(f"{route_id}: {name}" for name in unsupported)
        listed += count

    assert offences == []
    # And the fix is not "list nothing": 4,298 names are listed, against 5,083
    # before the named-in-the-text rule of which 752 were unsupported, and
    # 4,399 before the spelling gates of which 45 named a people and 44 named
    # another place. A floor rather than an equality, because the gazetteer's
    # own row count is another agent's to move and no re-ingest may quietly
    # empty this badge.
    assert listed >= MINIMUM_NAMES_IN_THE_CANON


def _book_and_chapter(route_id: str) -> tuple[int, int]:
    """Split "chapter:Acts.16" into its book number and chapter."""
    from app.modules.scripture.domain import NUMBER_TO_OSIS

    by_osis = {osis: number for number, osis in NUMBER_TO_OSIS.items()}
    osis, chapter = route_id.split(":", 1)[1].rsplit(".", 1)
    return (by_osis[osis], int(chapter))


async def test_no_waypoint_in_the_canon_names_anything_but_its_own_place(
    connection: asyncpg.Connection,
) -> None:
    """The second sweep, and the one the first cannot make.

    "Ammonites" IS spelled in the chapter it was listed under, so the
    named-in-the-text invariant above passed on all 45 of these. What they are
    not is places. Two failures, one pass over the canon:

    A people or a person. Measured before the spelling gates: Jews x10 pinned
    at Jerusalem and Judea, Ammonites x7, Amalekites x5, Moabites x4, Egyptians
    x4, and "Hadadezer" x3 -- a man -- pinned at Zobah. A label is only an
    offence when NO gazetteer row publishes it as its own name: the gentilic
    rule is deliberately broad enough to catch "Samaritan", which means it also
    catches "Canaan" and "Haran", and those are exempt because they are places.

    Another place's name. 44 pins carried one, plotted 25-1,423 km from the
    place they were labelled: Ezekiel 26:7 pinned Babylon and labelled it
    "Tyre", Ezekiel 27:15 pinned Rhodes and labelled it "Dedan", and Luke 2:4
    drew two pins both reading "Galilee" while never naming Judea, which the
    verse spells.
    """
    published = {
        row["normalised"]: set(row["place_ids"])
        for row in await connection.fetch(_PUBLISHED_NAMES)
    }
    route_ids = [row["route_id"] for row in await connection.fetch(_ALL_ROUTES)]
    if not route_ids:
        pytest.skip("The gazetteer is not loaded; run scripts.ingest_places.")

    offences: list[str] = []
    for route_id in route_ids:
        book, chapter = _book_and_chapter(route_id)
        data = await _load(connection, book, chapter)
        for pin in _route_pins(data):
            owners = published.get(normalise_name(pin.name), set())
            if owners and pin.place_id not in owners:
                offences.append(f"{route_id}: {pin.name} is pinned at {pin.place_id}")
            elif not owners and names_a_people(normalise_name(pin.name)):
                offences.append(f"{route_id}: {pin.name} names a people, not a place")

    assert offences == []


async def test_every_pin_carries_the_caveats_the_gazetteer_attaches_to_it(
    connection: asyncpg.Connection,
) -> None:
    """DECISIONS #10. Nine places are called Ramah and the sheet drew one dot.

    `homonym_count` reached the database in revision 0008 and nothing read it,
    so 1,153 of the 4,399 waypoints presented one of two to nine places as THE
    one. `candidate_count` -- rival dig sites for a single place -- was already
    surfaced by the 3D City teaser but never travelled on a route pin. Both now
    do, and this asserts each pin carries the gazetteer's own numbers rather
    than a default: a pin that silently defaulted to 1 would read as certainty.
    """
    rows = await connection.fetch(
        "SELECT place_id, homonym_count, candidate_count FROM places"
    )
    shared = {row["place_id"]: (row["homonym_count"], row["candidate_count"]) for row in rows}
    if not shared:
        pytest.skip("The gazetteer is not loaded; run scripts.ingest_places.")

    pins = []
    for _, book, chapter in CHAPTERS:
        data = await _load(connection, book, chapter)
        if data.is_empty:
            pytest.skip("Scripture is not loaded; run scripts.load_scripture BSB.")
        pins.extend(_route_pins(data))

    for pin in pins:
        expected = shared[pin.place_id]
        assert (pin.shared_name_count, pin.candidate_count) == expected, pin.name
    assert any(pin.shared_name_count > 1 for pin in pins), "no sampled chapter shares a name"
