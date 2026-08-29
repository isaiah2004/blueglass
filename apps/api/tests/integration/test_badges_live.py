"""The badge repository against real Postgres, on real Acts 16.

What a double cannot prove and this does: that the ten statements parse, that
the joins land on rows the ingest agents actually wrote, that the alignment
offsets stored months apart still select the words they claim out of the BSB
text being rendered, and that the whole pipeline is stable call to call.

Set ATLAS_TEST_DATABASE_URL to run. Inside the compose stack:

    docker compose exec -e ATLAS_TEST_DATABASE_URL=$DATABASE_URL api \
        python -m pytest tests/integration/test_badges_live.py
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import asyncpg
import pytest

from app.modules.badges.domain import (
    MAX_BADGES_PER_CHAPTER,
    MAX_BADGES_PER_VERSE,
    BadgeKind,
    ChapterBadgeData,
)
from app.modules.badges.domain.assembly import assemble_chapter_badges
from app.modules.badges.infrastructure.postgres_badge_repository import (
    _assemble,
    _chapter_range,
    _statements,
)

pytestmark = pytest.mark.integration

ACTS = 44
CHAPTER = 16
TRANSLATION = "BSB"


async def _load(connection: asyncpg.Connection, book: int, chapter: int) -> ChapterBadgeData:
    """Run the repository's own statements on the test's connection.

    Using `_statements` and `_assemble` rather than `PostgresBadgeRepository`
    keeps the test inside the rolled-back transaction the `connection` fixture
    owns, while still exercising exactly the SQL and mapping the adapter runs.
    """
    first, last = _chapter_range(book, chapter)
    results = [
        await connection.fetch(query, *args)
        for query, args in _statements(TRANSLATION, book, chapter, first, last)
    ]
    return _assemble(TRANSLATION, book, chapter, results)


@pytest.fixture
async def acts16(connection: asyncpg.Connection) -> AsyncIterator[ChapterBadgeData]:
    data = await _load(connection, ACTS, CHAPTER)
    if data.is_empty:
        pytest.skip("Scripture is not loaded; run scripts.ingest_scripture.")
    yield data


async def test_every_statement_parses_and_returns_rows(
    acts16: ChapterBadgeData,
) -> None:
    """The smoke test that catches a column renamed under us by an ingest agent."""
    assert len(acts16.verses) == 40
    assert acts16.sources
    assert acts16.places
    assert acts16.mentions
    assert acts16.routes
    assert acts16.dated_passages
    assert acts16.events
    assert acts16.rulers
    assert acts16.words
    assert acts16.cross_refs


async def test_acts_16_produces_a_full_chapter_of_badges(
    acts16: ChapterBadgeData,
) -> None:
    badges = assemble_chapter_badges(acts16)

    assert len(badges) == MAX_BADGES_PER_CHAPTER
    kinds = {badge.kind for badge in badges}
    assert BadgeKind.ROUTE in kinds
    assert BadgeKind.CITY_3D in kinds
    assert BadgeKind.HISTORY in kinds
    assert BadgeKind.ROOT in kinds
    assert BadgeKind.CROSS_REF in kinds


async def test_every_anchor_selects_its_own_text_from_the_bsb(
    acts16: ChapterBadgeData,
) -> None:
    """The invariant that stops a pill tinting the wrong word, on real text."""
    by_key = {verse.verse_key: verse.text for verse in acts16.verses}

    for badge in assemble_chapter_badges(acts16):
        text = by_key[badge.anchor.verse_key]
        sliced = text[badge.anchor.start_offset : badge.anchor.end_offset]
        assert sliced == badge.anchor.text, badge.id


async def test_anchors_are_stable_across_two_loads(
    connection: asyncpg.Connection, acts16: ChapterBadgeData
) -> None:
    """Two independent loads of the same chapter must agree exactly."""
    second = await _load(connection, ACTS, CHAPTER)

    first_badges = assemble_chapter_badges(acts16)
    second_badges = assemble_chapter_badges(second)

    assert [str(badge.id) for badge in first_badges] == [
        str(badge.id) for badge in second_badges
    ]
    assert [badge.anchor for badge in first_badges] == [
        badge.anchor for badge in second_badges
    ]


async def test_caps_hold_on_the_densest_chapter_we_have(
    acts16: ChapterBadgeData,
) -> None:
    badges = assemble_chapter_badges(acts16)

    per_verse: dict[int, int] = {}
    for badge in badges:
        per_verse[badge.anchor.verse_key] = per_verse.get(badge.anchor.verse_key, 0) + 1
    assert max(per_verse.values()) <= MAX_BADGES_PER_VERSE


async def test_every_badge_names_a_licensed_source(acts16: ChapterBadgeData) -> None:
    """AI-05 against the real provenance table."""
    for badge in assemble_chapter_badges(acts16):
        assert badge.is_renderable
        for source in badge.sources:
            assert source.licence
            assert source.attribution


async def test_the_history_badge_attributes_murai(acts16: ChapterBadgeData) -> None:
    """Q-015 against the real literary_structures rows."""
    history = [
        badge for badge in assemble_chapter_badges(acts16) if badge.kind is BadgeKind.HISTORY
    ]

    assert history
    payload = history[0].payload
    assert payload.interpretive_claim == "Murai's reading"
    assert payload.attributed_to == "Hajime Murai"
    assert payload.dating_origin == "sourced"
    assert payload.ruler_name == "Claudius"


async def test_the_route_maps_the_places_acts_16_names_and_claims_nothing_more(
    acts16: ChapterBadgeData,
) -> None:
    """Mention order, deduplicated, with no travel asserted anywhere in it.

    This test used to assert that Derbe is the "departure", which the chapter
    scheme cannot establish -- the order is the order the text prints the names.
    See `tests/unit/test_route_badge_claims.py` for the three verses of Acts 16
    that the old wording contradicted.
    """
    routes = [
        badge for badge in assemble_chapter_badges(acts16) if badge.kind is BadgeKind.ROUTE
    ]

    assert len(routes) == 1
    badge = routes[0]
    payload = badge.payload
    assert payload.waypoints[0].name == "Derbe"
    assert payload.title == "Places named in this chapter"
    assert badge.teaser == f"{len(payload.waypoints)} places named in this chapter"
    assert "journey" not in badge.teaser
    assert {point.role for point in payload.waypoints} <= {"waypoint", "island"}
    islands = {point.name for point in payload.waypoints if point.role == "island"}
    assert "Samothrace" in islands

    # A place the chapter names twice is one pin, not a round trip: Acts 16
    # names Mysia at 7 and 8, Troas at 8 and 11, and Macedonia three times.
    names = [point.name for point in payload.waypoints]
    assert len(names) == len(set(names))
    assert names.count("Mysia") == 1

    #: [longitude, latitude]. Troas is 39.7 N, 26.2 E -- longitude first.
    troas = next(point for point in payload.waypoints if point.name == "Troas")
    assert 26.0 < troas.coordinates[0] < 26.3
    assert 39.6 < troas.coordinates[1] < 39.9


async def test_a_chapter_with_no_enrichment_returns_no_badges(
    connection: asyncpg.Connection,
) -> None:
    """Leviticus 4 has verses and, today, nothing else.

    No place is named in it, no word of it is aligned, no passage of it is
    dated, and no cross-reference from it reaches ten votes. That is the
    ordinary state of most of the canon, and it must be an empty list rather
    than an error -- otherwise every unenriched chapter looks broken to the
    reader's client.
    """
    data = await _load(connection, 3, 4)
    if data.is_empty:
        pytest.skip("Scripture is not loaded; run scripts.ingest_scripture.")

    assert assemble_chapter_badges(data) == []


async def test_an_absent_chapter_loads_empty_rather_than_raising(
    connection: asyncpg.Connection,
) -> None:
    """The repository reports absence; naming it a 404 is the use case's job."""
    data = await _load(connection, ACTS, 99)

    assert data.is_empty
    assert assemble_chapter_badges(data) == []


#: (label, book, chapter) for the three chapters the sense-split defect was
#: reported on. Colossians 4:11 read "Ἰησοῦς · STRONG'S G2424 · 1 USE ... This
#: word occurs once in the whole of the Greek New Testament" while Colossians
#: 4:12 on the same screen read "a servant of Christ Jesus"; Romans 9:20 said
#: the same of ποιέω / G4160; Acts 4 printed "John: the Baptist, the apostle, a
#: member of the Sanhedrin, or John Mark" above "used once in the corpus".
_SENSE_SPLIT_CHAPTERS: tuple[tuple[str, int, int], ...] = (
    ("Colossians 4", 51, 4),
    ("Romans 9", 45, 9),
    ("Acts 4", 44, 4),
)


@pytest.mark.parametrize(
    ("label", "book", "chapter"),
    _SENSE_SPLIT_CHAPTERS,
    ids=[row[0] for row in _SENSE_SPLIT_CHAPTERS],
)
async def test_a_root_badge_counts_the_strongs_number_it_prints(
    connection: asyncpg.Connection, label: str, book: int, chapter: int
) -> None:
    """Pillar 3, at the sentence a reader actually reads.

    The chip prints `simple_strongs` and the stat strip prints
    `occurrence_count`. If those describe different keys the sheet asserts a
    frequency any concordance contradicts -- and because the builder picks the
    RAREST word in a verse, the artificially rare sense was preferentially
    chosen: the defect selected for itself.
    """
    from app.modules.badges.domain.builders import build_root_badges

    data = await _load(connection, book, chapter)
    if data.is_empty:
        pytest.skip("Scripture is not loaded; run scripts.ingest_scripture.")
    truth = {
        row["number"]: row["occurrences"]
        for row in await connection.fetch(
            """
            SELECT l.simple_strongs AS number, count(*) AS occurrences
              FROM verse_words w
              JOIN lexicon l ON l.strongs = w.strongs
             GROUP BY l.simple_strongs
            """
        )
    }
    if not truth:
        pytest.skip("The word layer is not loaded; run scripts.ingest_lexicon.")

    for badge in build_root_badges(data):
        payload = badge.payload
        assert payload.occurrence_count == truth[payload.strongs_number], (
            f"{label}: {payload.lemma} / {payload.strongs_number} is shown as "
            f"{payload.occurrence_count} uses, and occurs "
            f"{truth[payload.strongs_number]} times"
        )
