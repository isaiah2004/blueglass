"""The loaded gazetteer answers the questions the Route badge asks.

Against real Postgres, in a rolled-back transaction. The checks a parser test
cannot make: that the two-file join survived the COPY, that a name resolves to
a coordinate through SQL exactly as it does through PlaceGazetteer, and that
the derived route reads in the order scripture puts it in.
"""

from __future__ import annotations

import asyncpg
import pytest

from scripts.place_assertions import (
    EXPECTED_DISPUTED,
    EXPECTED_LOCATED,
    EXPECTED_MENTIONED_VERSES,
    EXPECTED_MENTIONS,
    EXPECTED_PLACES,
    EXPECTED_ROUTE_STOPS,
    EXPECTED_ROUTES,
    assert_places_are_sound,
)
from scripts.place_gazetteer import (
    GazetteerEntry,
    NameLink,
    PlaceGazetteer,
    normalise_place_name,
)

pytestmark = pytest.mark.integration

PHILIPPI_ID = "a49e1d0"
_SOURCE_ID = "SELECT id FROM data_sources WHERE key = 'openbible_geocoding'"


async def _source_id(connection: asyncpg.Connection) -> int:
    source_id = await connection.fetchval(_SOURCE_ID)
    if source_id is None:
        pytest.skip("The gazetteer is not loaded; run scripts.ingest_places.")
    return int(source_id)


async def test_the_measured_counts_hold(connection: asyncpg.Connection) -> None:
    await _source_id(connection)
    counted = await connection.fetchrow(
        """
        SELECT (SELECT count(*) FROM places) AS places,
               (SELECT count(*) FROM places WHERE lat IS NOT NULL) AS located,
               (SELECT count(*) FROM places WHERE candidate_count > 1) AS disputed,
               (SELECT count(*) FROM place_mentions) AS mentions,
               (SELECT count(DISTINCT verse_key) FROM place_mentions) AS verses,
               (SELECT count(*) FROM routes) AS routes,
               (SELECT count(*) FROM route_stops) AS stops
        """
    )

    assert counted["places"] == EXPECTED_PLACES
    assert counted["located"] == EXPECTED_LOCATED
    assert counted["disputed"] == EXPECTED_DISPUTED
    assert counted["mentions"] == EXPECTED_MENTIONS
    assert counted["verses"] == EXPECTED_MENTIONED_VERSES
    assert counted["routes"] == EXPECTED_ROUTES
    assert counted["stops"] == EXPECTED_ROUTE_STOPS


async def test_the_whole_assertion_suite_passes_against_the_live_tables(
    connection: asyncpg.Connection,
) -> None:
    await assert_places_are_sound(connection, await _source_id(connection))


async def test_the_coordinate_survived_the_two_file_join(
    connection: asyncpg.Connection,
) -> None:
    """ancient.jsonl has no coordinates at all; this one came from modern.jsonl."""
    await _source_id(connection)
    row = await connection.fetchrow(
        "SELECT name, lat, lng, modern_name, precision_meters FROM places WHERE place_id = $1",
        PHILIPPI_ID,
    )

    assert row is not None
    assert row["name"] == "Philippi"
    assert row["lat"] == pytest.approx(41.012072)
    assert row["lng"] == pytest.approx(24.284576)
    assert row["precision_meters"] == 5


async def test_which_places_are_named_in_this_verse(
    connection: asyncpg.Connection,
) -> None:
    """The badge's verse-level question, answered by one indexed lookup."""
    await _source_id(connection)
    names = [
        row["name"]
        for row in await connection.fetch(
            """
            SELECT p.name FROM place_mentions m
            JOIN places p ON p.place_id = m.place_id
            WHERE m.verse_key = $1 ORDER BY p.name
            """,
            44_016_012,
        )
    ]

    assert "Philippi" in names


async def test_the_derived_route_reads_in_the_order_scripture_does(
    connection: asyncpg.Connection,
) -> None:
    """Acts 16:11-12: Troas -> Samothrace -> Neapolis -> Philippi."""
    await _source_id(connection)
    stops = [
        row["name"]
        for row in await connection.fetch(
            """
            SELECT p.name FROM route_stops s
            JOIN places p ON p.place_id = s.place_id
            WHERE s.route_id = 'chapter:Acts.16' ORDER BY s.position
            """
        )
    ]
    leg = ["Troas", "Samothrace", "Neapolis", "Philippi"]
    start = stops.index("Samothrace") - 1

    assert stops[start : start + len(leg)] == leg


async def test_rival_candidate_sites_are_kept_beside_the_default_pin(
    connection: asyncpg.Connection,
) -> None:
    """777 places have more than one. DECISIONS #10 forbids collapsing them."""
    await _source_id(connection)
    row = await connection.fetchrow(
        "SELECT candidates, candidate_count FROM places "
        "WHERE candidate_count > 1 ORDER BY place_id LIMIT 1"
    )

    assert row is not None
    assert row["candidate_count"] > 1


async def test_the_generated_candidate_count_cannot_drift(
    connection: asyncpg.Connection,
) -> None:
    """It is GENERATED from candidates, so the two can never disagree."""
    generated = await connection.fetchval(
        "SELECT is_generated FROM information_schema.columns "
        "WHERE table_name = 'places' AND column_name = 'candidate_count'"
    )

    assert generated == "ALWAYS"


async def test_sql_and_python_resolve_a_name_to_the_same_place(
    connection: asyncpg.Connection,
) -> None:
    """The gazetteer is used at ingest time in Python and at read time in SQL.
    One normalisation rule means the two cannot disagree."""
    await _source_id(connection)
    normalised = normalise_place_name("Philippi")
    rows = await connection.fetch(
        """
        SELECT n.place_id, n.weight, p.name, p.lat, p.lng, p.confidence,
               p.candidate_count, p.feature_type
        FROM place_names n JOIN places p ON p.place_id = n.place_id
        WHERE n.normalised = $1 AND p.lat IS NOT NULL
        ORDER BY n.weight DESC, n.place_id
        """,
        normalised,
    )
    gazetteer = PlaceGazetteer.from_rows(
        [
            GazetteerEntry(
                place_id=row["place_id"],
                name=row["name"],
                lat=row["lat"],
                lng=row["lng"],
                confidence=row["confidence"],
                candidate_count=row["candidate_count"],
                feature_type=row["feature_type"],
            )
            for row in rows
        ],
        [NameLink(normalised, row["place_id"], row["weight"]) for row in rows],
    )
    hit = gazetteer.resolve("Philippi")

    assert hit is not None
    assert hit.entry.place_id == rows[0]["place_id"] == PHILIPPI_ID


async def test_named_verse_count_counts_only_the_verses_that_spell_the_place(
    connection: asyncpg.Connection,
) -> None:
    """The 3D City teaser reads "X - named in N verses of scripture".

    `place_mentions` classifies each row and only `name` means the English
    spells the place. Counting all of them made the sentence false for 232 of
    the 1,285 places with mentions and wrong on 280 of the 922 badges:
    Jerusalem read 955 where 766 spell it, and 2 Samuel 11:22 -- which names no
    place at all -- was among the 189 difference. The same number scores the
    badge, so an over-count also decided which badge a chapter showed.
    """
    wrong = await connection.fetchval(
        """
        SELECT count(*) FROM places p
          JOIN (SELECT place_id,
                       count(*) FILTER (WHERE mention_kind = 'name') AS named
                  FROM place_mentions GROUP BY place_id) m
            ON m.place_id = p.place_id
         WHERE p.named_verse_count <> m.named
        """,
    )
    assert wrong == 0


async def test_a_place_cannot_be_stored_outside_the_world(
    connection: asyncpg.Connection,
) -> None:
    """A swapped lonlat is the failure mode no row count would ever notice."""
    source_id = await _source_id(connection)

    with pytest.raises(asyncpg.exceptions.CheckViolationError):
        await connection.execute(
            "INSERT INTO places (place_id, name, slug, lat, lng, feature_type, "
            "source_id) VALUES ('atest', 'Nowhere', 'nowhere', 410.12, 24.28, "
            "'settlement', $1)",
            source_id,
        )


async def test_deleting_a_place_takes_its_names_and_mentions_with_it(
    connection: asyncpg.Connection,
) -> None:
    """What makes a re-ingest idempotent: nothing can be orphaned."""
    await _source_id(connection)
    await connection.execute("DELETE FROM places WHERE place_id = $1", PHILIPPI_ID)

    assert (
        await connection.fetchval(
            "SELECT count(*) FROM place_mentions WHERE place_id = $1", PHILIPPI_ID
        )
        == 0
    )
    assert (
        await connection.fetchval(
            "SELECT count(*) FROM place_names WHERE place_id = $1", PHILIPPI_ID
        )
        == 0
    )
