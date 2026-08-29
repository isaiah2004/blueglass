"""What must be true after the people ingest, checked against Postgres.

Purpose
    Counting parsed rows proves People.csv was whole; it does not prove the
    database agrees. These checks run inside the loading transaction, so a
    failure rolls the load back rather than publishing a half-built genealogy
    graph, the same discipline ``history_assertions.py`` applies to rulers.

What is checked, and why each one is here
    - COUNTS, measured on 2026-08-29 from the acquired People.csv (SHA-256
      ``44aa63e656077ed02a05747f581c56b5c9242a2d8cf7281344bc734085e0b130``,
      via ``scripts.theographic_people.read_people()``). A new upstream file
      should stop a load, not silently resize the graph.
    - PROVENANCE (``AI-05``). Every person, relation and mention row must
      reach a ``data_sources`` row with a non-blank attribution.
    - NO DANGLING EDGES. Every ``person_relations`` row must name two people
      that were actually written, not a ``personLookup`` this ingest dropped.
    - ONE SPOT CHECK a reader would notice: Paul is present under his
      Theographic id, so the Lineage badge has something to focus on for Acts.

Dependencies
    asyncpg only.

Usage
    await assert_people_is_sound(connection, len(people), len(relations), len(mentions))
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

#: Measured on 2026-08-29 from People.csv.
EXPECTED_PEOPLE = 3_069
EXPECTED_RELATIONS = 1_888
EXPECTED_PARENT_EDGES = 1_784
EXPECTED_SPOUSE_EDGES = 104
EXPECTED_MENTIONS = 28_240
EXPECTED_MALE = 2_868
EXPECTED_FEMALE = 201

#: Theographic's id for Paul -- present in Acts under this key throughout.
PAUL_PERSON_ID = "paul_2479"


class PersonIntegrityFailure(RuntimeError):
    """The people ingest failed one or more post-load checks."""


@dataclass(frozen=True, slots=True)
class Check:
    """One assertion: what a human reads when it fails, and its SQL."""

    label: str
    sql: str
    expected: int
    params: tuple[object, ...] = ()


def _count_checks(people: int, relations: int, mentions: int) -> tuple[Check, ...]:
    """Did every row the parser produced actually land?"""
    return (
        Check("people stored", "SELECT count(*) FROM people", people),
        Check("relations stored", "SELECT count(*) FROM person_relations", relations),
        Check("mentions stored", "SELECT count(*) FROM person_mentions", mentions),
        Check(
            "parent-of edges",
            "SELECT count(*) FROM person_relations WHERE kind = $1",
            EXPECTED_PARENT_EDGES,
            ("parent-of",),
        ),
        Check(
            "spouse-of edges",
            "SELECT count(*) FROM person_relations WHERE kind = $1",
            EXPECTED_SPOUSE_EDGES,
            ("spouse-of",),
        ),
        Check(
            "male people", "SELECT count(*) FROM people WHERE gender = $1", EXPECTED_MALE, ("Male",)
        ),
        Check(
            "female people",
            "SELECT count(*) FROM people WHERE gender = $1",
            EXPECTED_FEMALE,
            ("Female",),
        ),
    )


def _provenance_checks() -> tuple[Check, ...]:
    """AI-05, proven in SQL rather than trusted to a loader."""
    return (
        Check(
            "people with no attribution (must be none)",
            """
            SELECT count(*) FROM people p
            LEFT JOIN data_sources d ON d.id = p.source_id
            WHERE d.id IS NULL OR btrim(d.attribution) = ''
            """,
            0,
        ),
        Check(
            "relations with no attribution (must be none)",
            """
            SELECT count(*) FROM person_relations r
            LEFT JOIN data_sources d ON d.id = r.source_id
            WHERE d.id IS NULL OR btrim(d.attribution) = ''
            """,
            0,
        ),
        Check(
            "mentions with no attribution (must be none)",
            """
            SELECT count(*) FROM person_mentions m
            LEFT JOIN data_sources d ON d.id = m.source_id
            WHERE d.id IS NULL OR btrim(d.attribution) = ''
            """,
            0,
        ),
    )


def _graph_checks() -> tuple[Check, ...]:
    """No edge or mention may name a person this ingest did not write."""
    return (
        Check(
            "relations naming an unknown from_person_id (must be none)",
            """
            SELECT count(*) FROM person_relations r
            WHERE NOT EXISTS (SELECT 1 FROM people p WHERE p.person_id = r.from_person_id)
            """,
            0,
        ),
        Check(
            "relations naming an unknown to_person_id (must be none)",
            """
            SELECT count(*) FROM person_relations r
            WHERE NOT EXISTS (SELECT 1 FROM people p WHERE p.person_id = r.to_person_id)
            """,
            0,
        ),
        Check(
            "mentions naming an unknown person_id (must be none)",
            """
            SELECT count(*) FROM person_mentions m
            WHERE NOT EXISTS (SELECT 1 FROM people p WHERE p.person_id = m.person_id)
            """,
            0,
        ),
        Check(
            "duplicate person_id values (must be none)",
            """
            SELECT count(*) FROM (
                SELECT person_id FROM people GROUP BY person_id HAVING count(*) > 1
            ) duplicated
            """,
            0,
        ),
        Check(
            "Paul present under his Theographic id",
            "SELECT count(*) FROM people WHERE person_id = $1",
            1,
            (PAUL_PERSON_ID,),
        ),
    )


def _checks(people: int, relations: int, mentions: int) -> tuple[Check, ...]:
    """Every check that runs against the committed rows."""
    return (
        *_count_checks(people, relations, mentions),
        *_provenance_checks(),
        *_graph_checks(),
    )


async def assert_people_is_sound(
    connection: asyncpg.Connection, people: int, relations: int, mentions: int
) -> None:
    """Raise listing everything wrong, or return silently."""
    problems: list[str] = []
    if people != EXPECTED_PEOPLE:
        problems.append(f"people parsed: expected {EXPECTED_PEOPLE}, got {people}")
    if relations != EXPECTED_RELATIONS:
        problems.append(f"relations parsed: expected {EXPECTED_RELATIONS}, got {relations}")
    if mentions != EXPECTED_MENTIONS:
        problems.append(f"mentions parsed: expected {EXPECTED_MENTIONS}, got {mentions}")
    for check in _checks(people, relations, mentions):
        actual = await connection.fetchval(check.sql, *check.params)
        if actual != check.expected:
            problems.append(f"{check.label}: expected {check.expected}, got {actual}")
    if problems:
        joined = "\n  - ".join(problems)
        raise PersonIntegrityFailure(f"People ingest failed post-load checks:\n  - {joined}")
