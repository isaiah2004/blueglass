"""What is actually in Postgres after the history ingest.

The checks that matter here are the two decisions the badge could quietly
break: Q-016 (nothing outside the New Testament may carry a date) and AI-05
(every row names its source and licence).

Skipped unless ATLAS_TEST_DATABASE_URL is set, and skipped when nobody has run
the ingest.
"""

from __future__ import annotations

import asyncpg
import pytest

from scripts.history_assertions import (
    EXPECTED_ACTS_EVENTS,
    EXPECTED_DISTINCT_EVENTS,
    EXPECTED_EVENT_ROWS,
    EXPECTED_RULERS,
)

pytestmark = pytest.mark.integration

ACTS = 44
FIRST_NT_BOOK = 40


async def _skip_unless_loaded(connection: asyncpg.Connection) -> None:
    """Skip rather than fail when nobody has run the ingest."""
    loaded = await connection.fetchval("SELECT EXISTS (SELECT 1 FROM rulers)")
    if not loaded:
        pytest.skip("history is not loaded; run scripts.ingest_history")


async def test_both_series_of_the_timeline_are_present(
    connection: asyncpg.Connection,
) -> None:
    await _skip_unless_loaded(connection)

    counts = await connection.fetchrow(
        """
        SELECT (SELECT count(*) FROM rulers)                        AS rulers,
               (SELECT count(*) FROM historical_events)             AS events,
               (SELECT count(DISTINCT external_id)
                  FROM historical_events)                           AS distinct_events,
               (SELECT count(*) FROM historical_events
                 WHERE book_number = $1)                            AS acts_events
        """,
        ACTS,
    )

    assert counts["rulers"] == EXPECTED_RULERS
    assert counts["events"] == EXPECTED_EVENT_ROWS
    assert counts["distinct_events"] == EXPECTED_DISTINCT_EVENTS
    assert counts["acts_events"] == EXPECTED_ACTS_EVENTS


async def test_nothing_outside_the_new_testament_carries_a_date(
    connection: asyncpg.Connection,
) -> None:
    """Q-016. Ussher's 4004 BC must not reach a reader as neutral fact."""
    await _skip_unless_loaded(connection)

    old_testament = await connection.fetchrow(
        """
        SELECT (SELECT count(*) FROM passage_dating WHERE book_number < $1)   AS dated,
               (SELECT count(*) FROM historical_events WHERE book_number < $1) AS events
        """,
        FIRST_NT_BOOK,
    )

    assert old_testament["dated"] == 0
    assert old_testament["events"] == 0


async def test_the_schema_itself_refuses_an_old_testament_date(
    connection: asyncpg.Connection,
) -> None:
    """Q-016 is a constraint, not a convention a later loader could forget.

    Runs inside the fixture's rolled-back transaction, so the row never lands.
    """
    await _skip_unless_loaded(connection)
    source_id = await connection.fetchval("SELECT id FROM data_sources LIMIT 1")
    await connection.execute(
        """
        INSERT INTO passages (passage_id, book_number, chapter, start_key, end_key, scheme)
        VALUES ('test:genesis', 1, 1, 1001001, 1001031, 'test')
        """
    )

    with pytest.raises(asyncpg.CheckViolationError):
        await connection.execute(
            """
            INSERT INTO passage_dating
                (passage_id, book_number, year_approx, year_label, origin,
                 rationale, source_id)
            VALUES ('test:genesis', 1, -4003, '4004 BC', 'sourced', 'Ussher', $1)
            """,
            source_id,
        )


async def test_every_history_row_can_name_its_source_and_licence(
    connection: asyncpg.Connection,
) -> None:
    """AI-05. A badge with no provenance must not render, so none may exist."""
    await _skip_unless_loaded(connection)

    unattributed = await connection.fetchval(
        """
        SELECT (SELECT count(*) FROM rulers r
                  LEFT JOIN data_sources d ON d.id = r.source_id
                 WHERE d.id IS NULL OR btrim(d.attribution) = ''
                    OR btrim(d.license) = '')
             + (SELECT count(*) FROM historical_events e
                  LEFT JOIN data_sources d ON d.id = e.source_id
                 WHERE d.id IS NULL OR btrim(d.attribution) = ''
                    OR btrim(d.license) = '')
             + (SELECT count(*) FROM passage_dating p
                  LEFT JOIN data_sources d ON d.id = p.source_id
                 WHERE d.id IS NULL OR btrim(d.attribution) = ''
                    OR btrim(d.license) = '')
        """
    )

    assert unattributed == 0


async def test_the_share_alike_source_is_flagged_and_separable(
    connection: asyncpg.Connection,
) -> None:
    """Q-007's enforcement mechanism: one WHERE clause, not a code review."""
    await _skip_unless_loaded(connection)

    rows = await connection.fetch(
        """
        SELECT key, license, share_alike FROM data_sources
        WHERE key IN ('theographic_events', 'wikidata_rulers')
        ORDER BY key
        """
    )
    flags = {row["key"]: (row["license"], row["share_alike"]) for row in rows}

    assert flags["theographic_events"] == ("CC-BY-SA-4.0", True)
    assert flags["wikidata_rulers"] == ("CC0-1.0", False)


@pytest.mark.parametrize(
    ("year", "realm", "name"),
    [
        (30, "Roman Empire", "Tiberius"),
        (50, "Roman Empire", "Claudius"),
        (51, "Achaia", "Lucius Junius Gallio Annaeanus"),
    ],
)
async def test_the_rulers_the_new_testament_names_are_in_the_right_years(
    connection: asyncpg.Connection, year: int, realm: str, name: str
) -> None:
    """Gallio dates Acts 18; Tiberius and Claudius bracket the whole book."""
    await _skip_unless_loaded(connection)

    found = await connection.fetchval(
        """
        SELECT name FROM rulers
        WHERE realm = $1 AND int4range(start_year, end_year, '[]') @> $2::int
          AND name = $3
        """,
        realm,
        year,
        name,
    )

    assert found == name


async def test_every_acts_passage_is_dated_and_says_where_the_date_came_from(
    connection: asyncpg.Connection,
) -> None:
    """Acts is the MVP scope. A gap here is a badge that will not render."""
    await _skip_unless_loaded(connection)

    coverage = await connection.fetchrow(
        """
        SELECT count(*) AS passages,
               count(d.passage_id) AS dated,
               count(*) FILTER (WHERE btrim(d.rationale) <> '') AS explained
        FROM passages p
        LEFT JOIN passage_dating d ON d.passage_id = p.passage_id
        WHERE p.book_number = $1
        """,
        ACTS,
    )

    assert coverage["dated"] == coverage["passages"]
    assert coverage["explained"] == coverage["passages"]


async def test_a_dated_passage_really_overlaps_the_event_it_cites(
    connection: asyncpg.Connection,
) -> None:
    """The join is the whole claim; a dating row that misses its event lies."""
    await _skip_unless_loaded(connection)

    mismatched = await connection.fetchval(
        """
        SELECT count(*) FROM passage_dating d
        JOIN passages p ON p.passage_id = d.passage_id
        LEFT JOIN historical_events e ON e.id = d.event_id
        WHERE e.id IS NULL
           OR e.year_approx <> d.year_approx
           OR NOT int4range(e.start_key, e.end_key, '[]')
                  && int4range(p.start_key, p.end_key, '[]')
        """
    )

    assert mismatched == 0
