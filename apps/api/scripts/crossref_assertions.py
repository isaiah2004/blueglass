"""What must be true of the loaded cross-references, checked against Postgres.

Purpose
    Asserting the parsed row count proves the download was whole. It does not
    prove the database agrees: a COPY that dropped rows, a stale DELETE, or a
    verse key computed one way and stored another would all pass the parse
    check and fail a reader. These run against the real table INSIDE the
    loading transaction, so a failure rolls the load back instead of publishing
    it. The prototype's loader had no assertion at all, which is why nobody
    could say whether it had worked.

Key responsibilities
    Count the rows, prove the keys decode inside the canon, prove the ranges
    survived parsing, and prove the provenance row a badge must cite exists.

Dependencies
    asyncpg only. No application code.

Usage
    await assert_cross_references_are_sound(connection, source_id)
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

#: Measured from the acquired bytes on 2026-08-29, not taken from upstream
#: documentation. data/raw/openbible-cross-references/PROVENANCE.md records the
#: same figure beside the SHA-256 of the file it was measured from.
EXPECTED_ROWS = 344_799

#: Distinct source verses. 29,364 of the canon's 31,102 verses cite something.
EXPECTED_SOURCE_VERSES = 29_364

#: Rows whose target is a passage rather than a single verse.
EXPECTED_RANGED_ROWS = 88_150

#: Rows the community voted to zero or below. Loaded deliberately; DECISIONS
#: #11 filters them out at read time, where the threshold can still be tuned.
EXPECTED_NON_POSITIVE_VOTES = 3_506

_ROW_COUNT = "SELECT count(*) FROM cross_references"
_SOURCE_VERSES = "SELECT count(DISTINCT from_key) FROM cross_references"
_RANGED = "SELECT count(*) FROM cross_references WHERE to_end_key > to_start_key"
_NON_POSITIVE = "SELECT count(*) FROM cross_references WHERE votes <= 0"
_OUTSIDE_CANON = """
    SELECT count(*) FROM cross_references
    WHERE from_key / 1000000 NOT BETWEEN 1 AND 66
       OR to_start_key / 1000000 NOT BETWEEN 1 AND 66
       OR to_end_key / 1000000 NOT BETWEEN 1 AND 66
"""
_WRONG_SOURCE = "SELECT count(*) FROM cross_references WHERE source_id <> $1"
_ATTRIBUTED = """
    SELECT count(*) FROM data_sources
    WHERE id = $1 AND btrim(attribution) <> '' AND btrim(license) <> ''
      AND retrieved_at IS NOT NULL
"""

#: One published row, transcribed from the file: Gen.1.1 -> Isa.37.16, 63
#: votes. It proves the OSIS resolution, the key arithmetic and the vote column
#: all agree with the bytes, which three separate counts cannot.
_SPOT_CHECK = """
    SELECT votes FROM cross_references
    WHERE from_key = 1001001 AND to_start_key = 23037016 AND to_end_key = 23037016
"""
_SPOT_CHECK_VOTES = 63


class CrossReferenceIntegrityError(RuntimeError):
    """The loaded cross-references failed one or more post-load checks."""


@dataclass(frozen=True, slots=True)
class Check:
    """One assertion: the sentence a human reads when it fails."""

    label: str
    sql: str
    expected: int


_CHECKS: tuple[Check, ...] = (
    Check("row count", _ROW_COUNT, EXPECTED_ROWS),
    Check("distinct source verses", _SOURCE_VERSES, EXPECTED_SOURCE_VERSES),
    Check("rows targeting a range", _RANGED, EXPECTED_RANGED_ROWS),
    Check("rows with votes <= 0", _NON_POSITIVE, EXPECTED_NON_POSITIVE_VOTES),
    Check("keys outside books 1-66", _OUTSIDE_CANON, 0),
)


async def _failures(connection: asyncpg.Connection, source_id: int) -> list[str]:
    """Run every check and collect the ones that did not hold."""
    problems = [
        f"{check.label}: expected {check.expected}, got {actual}"
        for check in _CHECKS
        if (actual := await connection.fetchval(check.sql)) != check.expected
    ]
    orphans = await connection.fetchval(_WRONG_SOURCE, source_id)
    if orphans:
        problems.append(f"rows not attributed to source {source_id}: {orphans}")
    if await connection.fetchval(_ATTRIBUTED, source_id) != 1:
        problems.append(
            "the provenance row is missing a licence, an attribution or a "
            "retrieval date, so no badge built on it may render (AI-05)"
        )
    votes = await connection.fetchval(_SPOT_CHECK)
    if votes != _SPOT_CHECK_VOTES:
        problems.append(
            f"Gen.1.1 -> Isa.37.16 should carry {_SPOT_CHECK_VOTES} votes, got {votes}"
        )
    return problems


async def assert_cross_references_are_sound(
    connection: asyncpg.Connection, source_id: int
) -> None:
    """Raise CrossReferenceIntegrityError listing everything wrong, or return."""
    problems = await _failures(connection, source_id)
    if problems:
        joined = "\n  - ".join(problems)
        raise CrossReferenceIntegrityError(
            f"cross_references failed post-load checks:\n  - {joined}"
        )
