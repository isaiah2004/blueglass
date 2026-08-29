"""The cross-references in the live database are the ones the badge needs.

These run against real Postgres in a rolled-back transaction. They check what a
parser test cannot: that the COPY landed, that the index the badge's only query
uses exists, and that a row can name its own licence.

Run them with:
    docker compose exec -e ATLAS_TEST_DATABASE_URL=$DATABASE_URL api \
        pytest -m integration
"""

from __future__ import annotations

import asyncpg
import pytest

from scripts.crossref_assertions import (
    EXPECTED_NON_POSITIVE_VOTES,
    EXPECTED_RANGED_ROWS,
    EXPECTED_ROWS,
    EXPECTED_SOURCE_VERSES,
    assert_cross_references_are_sound,
)

pytestmark = pytest.mark.integration

_SOURCE_ID = "SELECT id FROM data_sources WHERE key = 'openbible_xref'"


async def _source_id(connection: asyncpg.Connection) -> int:
    source_id = await connection.fetchval(_SOURCE_ID)
    if source_id is None:
        pytest.skip("Cross-references are not loaded; run scripts.ingest_crossrefs.")
    return int(source_id)


async def test_every_published_row_is_present(connection: asyncpg.Connection) -> None:
    await _source_id(connection)

    assert await connection.fetchval("SELECT count(*) FROM cross_references") == (
        EXPECTED_ROWS
    )


async def test_the_measured_shape_of_the_table_holds(
    connection: asyncpg.Connection,
) -> None:
    await _source_id(connection)
    counted = await connection.fetchrow(
        """
        SELECT count(DISTINCT from_key) AS sources,
               count(*) FILTER (WHERE to_end_key > to_start_key) AS ranged,
               count(*) FILTER (WHERE votes <= 0) AS quiet
        FROM cross_references
        """
    )

    assert counted["sources"] == EXPECTED_SOURCE_VERSES
    assert counted["ranged"] == EXPECTED_RANGED_ROWS
    assert counted["quiet"] == EXPECTED_NON_POSITIVE_VOTES


async def test_the_whole_assertion_suite_passes_against_the_live_table(
    connection: asyncpg.Connection,
) -> None:
    """The same checks the loader runs before it commits."""
    await assert_cross_references_are_sound(connection, await _source_id(connection))


async def test_the_badge_query_returns_ranked_references(
    connection: asyncpg.Connection,
) -> None:
    """ "Give me the cross-references for this verse, best first" -- the one
    read path the Cross-Ref badge has."""
    await _source_id(connection)
    rows = await connection.fetch(
        """
        SELECT to_start_key, to_end_key, votes FROM cross_references
        WHERE from_key = $1 AND votes > 0
        ORDER BY votes DESC LIMIT 5
        """,
        43_003_016,
    )

    assert len(rows) == 5
    assert [row["votes"] for row in rows] == sorted(
        (row["votes"] for row in rows), reverse=True
    )


async def test_a_row_can_name_its_own_licence(connection: asyncpg.Connection) -> None:
    """AI-05: a badge with no provenance must not render, so the attribution
    is read from the database rather than hardcoded in a component."""
    row = await connection.fetchrow(
        """
        SELECT s.attribution, s.license, s.retrieved_at, s.share_alike
        FROM cross_references x JOIN data_sources s ON s.id = x.source_id
        WHERE x.from_key = $1 LIMIT 1
        """,
        1_001_001,
    )

    assert row is not None
    assert row["attribution"] == "Cross-references © OpenBible.info, CC BY 4.0"
    assert row["license"] == "CC-BY-4.0"
    assert row["share_alike"] is False
    assert row["retrieved_at"] is not None


async def test_the_hot_path_index_exists(connection: asyncpg.Connection) -> None:
    definitions = {
        row["indexname"]: row["indexdef"]
        for row in await connection.fetch(
            "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'cross_references'"
        )
    }

    assert "votes DESC" in definitions["xref_from_idx"]
    assert "to_start_key" in definitions["xref_to_idx"]


async def test_a_backwards_range_cannot_be_stored(
    connection: asyncpg.Connection,
) -> None:
    source_id = await _source_id(connection)

    with pytest.raises(asyncpg.exceptions.CheckViolationError):
        await connection.execute(
            "INSERT INTO cross_references "
            "(from_key, to_start_key, to_end_key, votes, source_id) "
            "VALUES (1001001, 23037017, 23037016, 1, $1)",
            source_id,
        )
