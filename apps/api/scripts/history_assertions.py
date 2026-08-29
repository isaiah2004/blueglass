"""What must be true after the history ingest, checked against Postgres.

Purpose
    Counting parsed rows proves the files were whole; it does not prove the
    database agrees. These checks run inside the loading transaction, so a
    failure rolls the load back rather than publishing a half-built timeline.

What is checked, and why each one is here
    - COUNTS, measured on 2026-08-29 from the acquired files. A change upstream
      should stop a load, not silently move the badge's coverage.
    - PROVENANCE (``AI-05``). Every ruler, event and dating row must reach a
      ``data_sources`` row with a non-blank attribution, because a badge with
      no provenance must not render.
    - Q-016. Nothing outside the New Testament may carry a date. The schema
      forbids it; this proves the schema is doing its job.
    - THREE SPOT CHECKS a reader would notice: the emperor, the prefect and the
      proconsul the New Testament names by title.

Dependencies
    asyncpg only.

Usage
    await assert_history_is_sound(connection, ruler_count, event_count)
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

#: Measured on 2026-08-29 from the two saved SPARQL results and Events.csv.
EXPECTED_RULERS = 43
EXPECTED_EVENT_ROWS = 329
EXPECTED_DISTINCT_EVENTS = 203
EXPECTED_ACTS_EVENTS = 81

FIRST_NT_BOOK = 40
ACTS_BOOK = 44

#: (year, lane, value, person). "lane" picks which of the two spot-check
#: queries below runs. Every person here is named in the New Testament, and
#: they come from both acquired files, so together they prove each one loaded.
SPOT_CHECKS: tuple[tuple[int, str, str, str], ...] = (
    (30, "realm", "Roman Empire", "Tiberius"),
    (30, "title", "Prefect", "Pontius Pilatus"),
    (51, "realm", "Achaia", "Lucius Junius Gallio Annaeanus"),
)


class HistoryIntegrityFailure(RuntimeError):
    """The history ingest failed one or more post-load checks."""


@dataclass(frozen=True, slots=True)
class Check:
    """One assertion: what a human reads when it fails, and its SQL.

    ``params`` exists so no SQL in this file is built by string formatting;
    every value a query needs crosses as a bound parameter.
    """

    label: str
    sql: str
    expected: int
    params: tuple[object, ...] = ()


def _count_checks(ruler_count: int, event_count: int) -> tuple[Check, ...]:
    """Did every row the parsers produced actually land?"""
    return (
        Check("rulers stored", "SELECT count(*) FROM rulers", ruler_count),
        Check("events stored", "SELECT count(*) FROM historical_events", event_count),
        Check(
            "distinct events stored",
            "SELECT count(DISTINCT external_id) FROM historical_events",
            EXPECTED_DISTINCT_EVENTS,
        ),
        Check(
            "events in Acts",
            "SELECT count(*) FROM historical_events WHERE book_number = $1",
            EXPECTED_ACTS_EVENTS,
            (ACTS_BOOK,),
        ),
    )


def _provenance_checks() -> tuple[Check, ...]:
    """AI-05 and Q-016, proven in SQL rather than trusted to a loader."""
    return (
        Check(
            "rulers with no attribution (must be none)",
            """
            SELECT count(*) FROM rulers r
            LEFT JOIN data_sources d ON d.id = r.source_id
            WHERE d.id IS NULL OR btrim(d.attribution) = ''
            """,
            0,
        ),
        Check(
            "events with no attribution (must be none)",
            """
            SELECT count(*) FROM historical_events e
            LEFT JOIN data_sources d ON d.id = e.source_id
            WHERE d.id IS NULL OR btrim(d.attribution) = ''
            """,
            0,
        ),
        Check(
            "dated passages outside the New Testament (must be none: Q-016)",
            "SELECT count(*) FROM passage_dating WHERE book_number < $1",
            0,
            (FIRST_NT_BOOK,),
        ),
        Check(
            "dated passages with no rationale (must be none)",
            "SELECT count(*) FROM passage_dating WHERE btrim(rationale) = ''",
            0,
        ),
        Check(
            "dated passages not marked as sourced (must be none)",
            "SELECT count(*) FROM passage_dating WHERE origin <> 'sourced'",
            0,
        ),
        Check(
            "rulers with neither a start nor an end year (must be none)",
            "SELECT count(*) FROM rulers WHERE start_year IS NULL AND end_year IS NULL",
            0,
        ),
    )


def _checks(ruler_count: int, event_count: int) -> tuple[Check, ...]:
    """Every check that runs against the committed rows."""
    return (*_count_checks(ruler_count, event_count), *_provenance_checks())


#: Written out twice rather than interpolating a column name, so no SQL in
#: this file is built by string formatting.
_RULER_BY_REALM = """
    SELECT count(*) FROM rulers
    WHERE realm = $1 AND name = $2
      AND int4range(start_year, end_year, '[]') @> $3::int
"""

_RULER_BY_TITLE = """
    SELECT count(*) FROM rulers
    WHERE title = $1 AND name = $2
      AND int4range(start_year, end_year, '[]') @> $3::int
"""

_SPOT_CHECK_QUERIES = {"realm": _RULER_BY_REALM, "title": _RULER_BY_TITLE}


async def _spot_check_failures(connection: asyncpg.Connection) -> list[str]:
    """Prove the three people a reader would notice are in the right years."""
    problems: list[str] = []
    for year, lane, value, name in SPOT_CHECKS:
        found = await connection.fetchval(_SPOT_CHECK_QUERIES[lane], value, name, year)
        if not found:
            problems.append(f"{name} is not recorded as holding {value} in year {year}")
    return problems


async def _dating_failures(connection: asyncpg.Connection) -> list[str]:
    """Prove every dated passage really overlaps the event it cites.

    A consistency check rather than a magic number: the row count depends on
    how many passages the structure ingest loaded, but the relationship between
    a dating row and its event must hold whatever that number is.
    """
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
    if mismatched:
        return [f"{mismatched} dated passages do not overlap the event they cite"]
    return []


async def assert_history_is_sound(
    connection: asyncpg.Connection, ruler_count: int, event_count: int
) -> None:
    """Raise listing everything wrong, or return silently."""
    problems: list[str] = []
    if ruler_count != EXPECTED_RULERS:
        problems.append(f"rulers parsed: expected {EXPECTED_RULERS}, got {ruler_count}")
    if event_count != EXPECTED_EVENT_ROWS:
        problems.append(
            f"event rows parsed: expected {EXPECTED_EVENT_ROWS}, got {event_count}"
        )
    for check in _checks(ruler_count, event_count):
        actual = await connection.fetchval(check.sql, *check.params)
        if actual != check.expected:
            problems.append(f"{check.label}: expected {check.expected}, got {actual}")
    problems.extend(await _spot_check_failures(connection))
    problems.extend(await _dating_failures(connection))
    if problems:
        joined = "\n  - ".join(problems)
        raise HistoryIntegrityFailure(f"History ingest failed post-load checks:\n  - {joined}")
