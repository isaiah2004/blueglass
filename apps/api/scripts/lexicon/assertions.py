"""Prove the word layer is sound before the transaction commits.

Purpose
    The prototype's `load_more_translations.py` asserted nothing, so nobody
    could tell whether it had worked. Every check here runs INSIDE the load
    transaction: a failure rolls the whole load back rather than leaving a
    plausible-looking half-corpus behind.

What is checked, and why each one caught something real
    - Row counts against the counts measured from the files on disk.
    - Every word's verse key exists in the KJV New Testament. This is the
      versification check: without TAGNT's inline `[chapter.verse]` KJV override
      it fails on 235 words, and with it the two sets match exactly at 7,957.
    - No lexeme carries a definition without a definition source (AI-05 at the
      row level, in addition to the schema's CHECK).
    - The usage aggregate is keyed on the Strong's number the badge PRINTS,
      not on the disambiguated sense key the word rows carry.
    - Every alignment points at a real word of the SAME verse.

Dependencies
    asyncpg only.

Usage
    await assert_word_layer_is_sound(connection, expectations)
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

FIRST_NT_BOOK_NUMBER = 40


class WordLayerAssertionError(RuntimeError):
    """The loaded word layer does not match what the files say it should be."""


@dataclass(frozen=True, slots=True)
class Expectations:
    """Counts measured from the source files this run, not recalled constants."""

    words: int
    lexemes_at_least: int
    word_source_id: int
    alignment_source_id: int


async def _require(connection: asyncpg.Connection, sql: str, *args: object) -> int:
    value = await connection.fetchval(sql, *args)
    return int(value or 0)


async def _assert_counts(connection: asyncpg.Connection, expected: Expectations) -> None:
    words = await _require(
        connection,
        "SELECT count(*) FROM verse_words WHERE source_id = $1",
        expected.word_source_id,
    )
    if words != expected.words:
        raise WordLayerAssertionError(
            f"verse_words holds {words} rows for this source, the files parsed to "
            f"{expected.words}. Refusing to commit a partial word layer."
        )
    lexemes = await _require(connection, "SELECT count(*) FROM lexicon")
    if lexemes < expected.lexemes_at_least:
        raise WordLayerAssertionError(
            f"lexicon holds {lexemes} rows, expected at least {expected.lexemes_at_least}."
        )


async def _assert_versification(
    connection: asyncpg.Connection, expected: Expectations
) -> None:
    """Every tagged word must land on a verse the reader can actually open."""
    orphans = await _require(
        connection,
        """
        SELECT count(*) FROM (
            SELECT DISTINCT w.verse_key
              FROM verse_words w
             WHERE w.source_id = $1
               AND NOT EXISTS (
                   SELECT 1 FROM verses v
                    WHERE v.translation = 'KJV' AND v.verse_key = w.verse_key)
        ) AS missing
        """,
        expected.word_source_id,
    )
    if orphans:
        raise WordLayerAssertionError(
            f"{orphans} verse keys in verse_words have no KJV verse. The TAGNT "
            "reference is NRSV-versified; its inline [chapter.verse] KJV override "
            "must be applied."
        )


async def _assert_provenance(connection: asyncpg.Connection) -> None:
    """AI-05: nothing renders without a named source."""
    unsourced = await _require(
        connection,
        "SELECT count(*) FROM lexicon "
        "WHERE definition IS NOT NULL AND definition_source_id IS NULL",
    )
    if unsourced:
        raise WordLayerAssertionError(
            f"{unsourced} lexicon rows carry a definition with no source. "
            "A badge with no provenance must not render."
        )


async def _assert_usage_counts_the_published_number(
    connection: asyncpg.Connection, expected: Expectations
) -> None:
    """Pillar 3: the number the badge prints is the number the badge counts.

    `lexicon` is keyed per disambiguated sense and the Root badge publishes
    `simple_strongs`, so an aggregate keyed the other way pairs a checkable
    number with a count of one sense of it -- which is how 26 badges came to
    say Ἰησοῦς occurs once. This proves the aggregate is grouped the way the
    payload is published, from the word rows themselves.
    """
    mismatched = await _require(
        connection,
        """
        SELECT count(*)
          FROM (
              SELECT l.simple_strongs AS number, count(*) AS occurrences
                FROM verse_words w
                JOIN lexicon l ON l.strongs = w.strongs
               WHERE w.source_id = $1
               GROUP BY l.simple_strongs
          ) AS counted
          LEFT JOIN lexicon_usage u ON u.simple_strongs = counted.number
         WHERE u.occurrence_count IS DISTINCT FROM counted.occurrences
        """,
        expected.word_source_id,
    )
    if mismatched:
        raise WordLayerAssertionError(
            f"{mismatched} Strong's numbers are counted under a key other than "
            "the one the badge prints. A rarity claim beside a number it is not "
            "a count of is a false claim."
        )


async def _assert_alignments(connection: asyncpg.Connection, expected: Expectations) -> None:
    """An alignment must point at a word of its own verse, or it is a lie."""
    crossed = await _require(
        connection,
        """
        SELECT count(*)
          FROM verse_word_alignments a
          JOIN verse_words w ON w.id = a.verse_word_id
         WHERE a.source_id = $1 AND w.verse_key <> a.verse_key
        """,
        expected.alignment_source_id,
    )
    if crossed:
        raise WordLayerAssertionError(
            f"{crossed} alignments point at a word in a different verse."
        )


async def assert_word_layer_is_sound(
    connection: asyncpg.Connection, expected: Expectations
) -> None:
    """Run every gate. Any failure aborts the load."""
    await _assert_counts(connection, expected)
    await _assert_versification(connection, expected)
    await _assert_provenance(connection)
    await _assert_usage_counts_the_published_number(connection, expected)
    await _assert_alignments(connection, expected)
