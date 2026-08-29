"""What must be true of a loaded translation, checked against the real table.

Purpose
    Asserting the parsed row count proves the file was whole. It does not prove
    the database agrees -- a COPY that dropped rows, a stale DELETE, or a
    verse_key computed one way and stored another would all pass the parse check
    and fail a reader. These checks run against Postgres, INSIDE the loading
    transaction, so a failure rolls the load back instead of publishing it.

Key responsibilities
    Count the rows, count the books, and prove the two verse identities agree
    with the columns they are derived from.

Dependencies
    asyncpg and the catalogue. No application code.

Usage
    await assert_translation_is_sound(connection, source)
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from scripts.translation_catalogue import TranslationSource

#: Three verses no complete Bible can be missing, one from each end of the
#: canon and the one every reader checks first. Present in all four editions.
SPOT_CHECK_KEYS: tuple[tuple[int, str], ...] = (
    (1_001_001, "Genesis 1:1"),
    (43_003_016, "John 3:16"),
    (66_022_021, "Revelation 22:21"),
)

_VERSE_COUNT = "SELECT count(*) FROM verses WHERE translation = $1"
_BOOK_COUNT = "SELECT count(DISTINCT book_number) FROM verses WHERE translation = $1"
_BLANK_TEXT = "SELECT count(*) FROM verses WHERE translation = $1 AND btrim(text) = ''"
_KEY_DISAGREES = """
    SELECT count(*) FROM verses
    WHERE translation = $1
      AND verse_key <> book_number * 1000000 + chapter * 1000 + verse
"""
_OSIS_MISSING = """
    SELECT count(*) FROM verses
    WHERE translation = $1 AND (osis_id IS NULL OR btrim(osis_id) = '')
"""
_PROVENANCE_LINKED = """
    SELECT count(*) FROM translations t
    JOIN data_sources s ON s.id = t.source_id
    WHERE t.code = $1 AND btrim(s.attribution) <> ''
"""
_SPOT_CHECK = """
    SELECT count(*) FROM verses
    WHERE translation = $1 AND verse_key = $2 AND length(btrim(text)) > 10
"""


class IntegrityFailure(RuntimeError):
    """A loaded translation failed one or more post-load checks."""


@dataclass(frozen=True, slots=True)
class Expectation:
    """One check: the description a human reads when it fails."""

    label: str
    sql: str
    expected: int


def _expectations(source: TranslationSource) -> tuple[Expectation, ...]:
    """Every check that takes only the translation code as a parameter."""
    return (
        Expectation("verse count", _VERSE_COUNT, source.expected_verses),
        Expectation("books covered", _BOOK_COUNT, 66),
        Expectation("blank verse texts", _BLANK_TEXT, 0),
        Expectation("verse_key disagrees with book/chapter/verse", _KEY_DISAGREES, 0),
        Expectation("missing osis_id", _OSIS_MISSING, 0),
        Expectation("provenance row with an attribution", _PROVENANCE_LINKED, 1),
    )


async def _failures(connection: asyncpg.Connection, source: TranslationSource) -> list[str]:
    """Run every check and collect the ones that did not hold."""
    problems: list[str] = []
    for check in _expectations(source):
        actual = await connection.fetchval(check.sql, source.code)
        if actual != check.expected:
            problems.append(f"{check.label}: expected {check.expected}, got {actual}")
    for key, reference in SPOT_CHECK_KEYS:
        if await connection.fetchval(_SPOT_CHECK, source.code, key) != 1:
            problems.append(f"{reference} ({key}) is missing or suspiciously short")
    return problems


async def assert_translation_is_sound(
    connection: asyncpg.Connection, source: TranslationSource
) -> None:
    """Raise IntegrityFailure listing everything wrong, or return silently."""
    problems = await _failures(connection, source)
    if problems:
        joined = "\n  - ".join(problems)
        raise IntegrityFailure(f"{source.code} failed post-load checks:\n  - {joined}")
