"""What must be true after the dictionary ingest, checked against Postgres.

Purpose
    Counting parsed rows proves the 52 acquired JSON files were whole; it
    does not prove the database agrees. These checks run inside the loading
    transaction, the same discipline ``person_assertions.py`` and
    ``history_assertions.py`` apply to their own tables.

What is checked, and why each one is here
    - COUNTS, measured on 2026-08-29 against the acquired NEUU files (see
      ``data/raw/neuu-bible-dictionary/PROVENANCE.md`` for per-file digests)
      using ``scripts.neuu_dictionary.read_dictionary()``.
    - PROVENANCE (``AI-05``). Every entry and citation row must reach a
      ``data_sources`` row with a non-blank attribution.
    - NO DANGLING CITATIONS. Every ``dictionary_citations`` row must name an
      ``entry_id`` that was actually written.
    - ONE SPOT CHECK a reader would notice: Easton's own entry for Paul is
      present, since Acts is this MVP's book.

Dependencies
    asyncpg only.

Usage
    await assert_dictionary_is_sound(connection, len(entries), len(citations))
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

#: Measured on 2026-08-29 against the acquired NEUU Easton + Smith files.
EXPECTED_ENTRIES = 8_523
EXPECTED_EASTON_ENTRIES = 3_962
EXPECTED_SMITH_ENTRIES = 4_561
EXPECTED_CITATIONS = 54_545
EXPECTED_EMPTY_DEFINITIONS = 73

#: Easton's own headword for the apostle -- present because Acts is this
#: MVP's book.
PAUL_ENTRY_ID = "EAS:PAUL"


class DictionaryIntegrityFailure(RuntimeError):
    """The dictionary ingest failed one or more post-load checks."""


@dataclass(frozen=True, slots=True)
class Check:
    """One assertion: what a human reads when it fails, and its SQL."""

    label: str
    sql: str
    expected: int
    params: tuple[object, ...] = ()


def _count_checks(entries: int, citations: int) -> tuple[Check, ...]:
    """Did every row the parser produced actually land?"""
    return (
        Check("entries stored", "SELECT count(*) FROM dictionary_entries", entries),
        Check("citations stored", "SELECT count(*) FROM dictionary_citations", citations),
        Check(
            "Easton entries",
            "SELECT count(*) FROM dictionary_entries WHERE source = $1",
            EXPECTED_EASTON_ENTRIES,
            ("EAS",),
        ),
        Check(
            "Smith entries",
            "SELECT count(*) FROM dictionary_entries WHERE source = $1",
            EXPECTED_SMITH_ENTRIES,
            ("SMI",),
        ),
        Check(
            "entries with no definition text (must match the source's own gap)",
            "SELECT count(*) FROM dictionary_entries WHERE btrim(definition_text) = ''",
            EXPECTED_EMPTY_DEFINITIONS,
        ),
    )


def _provenance_checks() -> tuple[Check, ...]:
    """AI-05, proven in SQL rather than trusted to a loader."""
    return (
        Check(
            "entries with no attribution (must be none)",
            """
            SELECT count(*) FROM dictionary_entries e
            LEFT JOIN data_sources d ON d.id = e.source_id
            WHERE d.id IS NULL OR btrim(d.attribution) = ''
            """,
            0,
        ),
        Check(
            "citations with no attribution (must be none)",
            """
            SELECT count(*) FROM dictionary_citations c
            LEFT JOIN data_sources d ON d.id = c.source_id
            WHERE d.id IS NULL OR btrim(d.attribution) = ''
            """,
            0,
        ),
    )


def _graph_checks() -> tuple[Check, ...]:
    """No citation may name an entry this ingest did not write."""
    return (
        Check(
            "citations naming an unknown entry_id (must be none)",
            """
            SELECT count(*) FROM dictionary_citations c
            WHERE NOT EXISTS (
                SELECT 1 FROM dictionary_entries e WHERE e.entry_id = c.entry_id
            )
            """,
            0,
        ),
        Check(
            "citations that end before they start (must be none)",
            "SELECT count(*) FROM dictionary_citations WHERE end_key < start_key",
            0,
        ),
        Check(
            "duplicate entry_id values (must be none)",
            """
            SELECT count(*) FROM (
                SELECT entry_id FROM dictionary_entries
                GROUP BY entry_id HAVING count(*) > 1
            ) duplicated
            """,
            0,
        ),
        Check(
            "Paul present under Easton's own headword",
            "SELECT count(*) FROM dictionary_entries WHERE entry_id = $1",
            1,
            (PAUL_ENTRY_ID,),
        ),
    )


def _checks(entries: int, citations: int) -> tuple[Check, ...]:
    """Every check that runs against the committed rows."""
    return (
        *_count_checks(entries, citations),
        *_provenance_checks(),
        *_graph_checks(),
    )


async def assert_dictionary_is_sound(
    connection: asyncpg.Connection, entries: int, citations: int
) -> None:
    """Raise listing everything wrong, or return silently."""
    problems: list[str] = []
    if entries != EXPECTED_ENTRIES:
        problems.append(f"entries parsed: expected {EXPECTED_ENTRIES}, got {entries}")
    if citations != EXPECTED_CITATIONS:
        problems.append(f"citations parsed: expected {EXPECTED_CITATIONS}, got {citations}")
    for check in _checks(entries, citations):
        actual = await connection.fetchval(check.sql, *check.params)
        if actual != check.expected:
            problems.append(f"{check.label}: expected {check.expected}, got {actual}")
    if problems:
        joined = "\n  - ".join(problems)
        raise DictionaryIntegrityFailure(
            f"Dictionary ingest failed post-load checks:\n  - {joined}"
        )
