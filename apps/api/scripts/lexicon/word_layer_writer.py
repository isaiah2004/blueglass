"""Write the word layer, idempotently, inside one transaction.

Purpose
    Replace the lexicon, the Greek word rows, the English alignments and the
    usage aggregates in a single transaction, so a failed run leaves the
    database exactly as it was rather than half-loaded.

Idempotence
    Delete-then-COPY, scoped by `source_id`. Re-running changes nothing but
    `data_sources.loaded_at`. The prototype's `load_more_translations.py` had
    neither a scope nor an assertion, which is why nobody could say whether it
    had worked; every count here is measured after the write and checked before
    the transaction commits.

Dependencies
    asyncpg. Takes already-built rows; it does no parsing and no alignment.

Usage
    await write_word_layer(connection, plan)
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import asyncpg

from .alignment_builder import AlignmentRow
from .assertions import Expectations, assert_word_layer_is_sound
from .lexeme_builder import LexiconRow
from .tagnt_parser import TagntWord

_WORD_COLUMNS = (
    "verse_key", "word_index", "surface", "translit", "lemma", "strongs",
    "morph", "gloss", "variant_code", "editions", "source_id",
)  # fmt: skip

_ALIGNMENT_COLUMNS = (
    "translation", "verse_key", "token_index", "token", "char_start",
    "char_end", "verse_word_id", "method", "confidence", "source_id",
)  # fmt: skip

#: Aggregates the Root sheet's stat strip renders. Computed from the rows just
#: written, in the same transaction, so the counts can never describe a corpus
#: other than the one on disk.
_BUILD_USAGE = """
    INSERT INTO lexicon_usage
        (strongs, occurrence_count, verse_count, book_count, first_verse_key,
         source_id)
    SELECT strongs,
           count(*),
           count(DISTINCT verse_key),
           count(DISTINCT verse_key / 1000000),
           min(verse_key),
           $1
      FROM verse_words
     WHERE source_id = $1
     GROUP BY strongs
"""


@dataclass(frozen=True, slots=True)
class WordLayerPlan:
    """Everything one ingest run intends to write, already built and counted."""

    lexicon_rows: Sequence[LexiconRow]
    words: Sequence[TagntWord]
    alignments: Sequence[AlignmentRow]
    word_source_id: int
    alignment_source_id: int
    expectations: Expectations


@dataclass(frozen=True, slots=True)
class WriteResult:
    """Row counts MEASURED from the database after the write, never expected."""

    lexemes: int
    words: int
    alignments: int
    usage_rows: int


async def _replace_lexicon(connection: asyncpg.Connection, rows: Sequence[LexiconRow]) -> None:
    """Truncating is wrong here -- verse_words references these rows -- so the
    lexicon is upserted and nothing is deleted. A number that vanishes upstream
    stays behind as an unreferenced row rather than breaking a foreign key."""
    await connection.executemany(
        """
        INSERT INTO lexicon (strongs, simple_strongs, lang, lemma, translit, pos,
                             short_gloss, definition, definition_source_id, source_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (strongs) DO UPDATE SET
            simple_strongs = excluded.simple_strongs, lang = excluded.lang,
            lemma = excluded.lemma, translit = excluded.translit,
            pos = excluded.pos, short_gloss = excluded.short_gloss,
            definition = excluded.definition,
            definition_source_id = excluded.definition_source_id,
            source_id = excluded.source_id
        """,
        [
            (
                row.strongs,
                row.simple_strongs,
                row.lang,
                row.lemma,
                row.translit,
                row.pos,
                row.short_gloss,
                row.definition,
                row.definition_source_id,
                row.source_id,
            )
            for row in rows
        ],
    )


async def _replace_words(
    connection: asyncpg.Connection, words: Sequence[TagntWord], source_id: int
) -> None:
    """Alignments cascade from verse_words, so they go with them."""
    await connection.execute("DELETE FROM verse_words WHERE source_id = $1", source_id)
    await connection.copy_records_to_table(
        "verse_words",
        records=[
            (
                word.verse_key,
                word.word_index,
                word.surface,
                word.translit,
                word.lemma,
                word.strongs,
                word.morph,
                word.gloss,
                word.variant_code,
                word.editions,
                source_id,
            )
            for word in words
        ],
        columns=list(_WORD_COLUMNS),
    )


async def _word_ids(
    connection: asyncpg.Connection, source_id: int
) -> dict[tuple[int, int], int]:
    """Map (verse_key, word_index) to the surrogate id the alignments need."""
    rows = await connection.fetch(
        "SELECT id, verse_key, word_index FROM verse_words WHERE source_id = $1",
        source_id,
    )
    return {(row["verse_key"], row["word_index"]): row["id"] for row in rows}


async def _write_alignments(
    connection: asyncpg.Connection,
    alignments: Sequence[AlignmentRow],
    ids: dict[tuple[int, int], int],
    source_id: int,
) -> None:
    await connection.execute(
        "DELETE FROM verse_word_alignments WHERE source_id = $1", source_id
    )
    await connection.copy_records_to_table(
        "verse_word_alignments",
        records=[
            (
                row.translation,
                row.verse_key,
                row.token_index,
                row.token,
                row.char_start,
                row.char_end,
                ids[(row.verse_key, row.word_index)],
                row.method,
                row.confidence,
                source_id,
            )
            for row in alignments
        ],
        columns=list(_ALIGNMENT_COLUMNS),
    )


async def write_word_layer(connection: asyncpg.Connection, plan: WordLayerPlan) -> WriteResult:
    """Write the whole word layer and measure what landed."""
    async with connection.transaction():
        await _replace_lexicon(connection, plan.lexicon_rows)
        await _replace_words(connection, plan.words, plan.word_source_id)
        ids = await _word_ids(connection, plan.word_source_id)
        await _write_alignments(connection, plan.alignments, ids, plan.alignment_source_id)
        await connection.execute(
            "DELETE FROM lexicon_usage WHERE source_id = $1", plan.word_source_id
        )
        await connection.execute(_BUILD_USAGE, plan.word_source_id)
        await assert_word_layer_is_sound(connection, plan.expectations)
        return await measure(connection, plan)


async def measure(connection: asyncpg.Connection, plan: WordLayerPlan) -> WriteResult:
    """Count what is actually in the tables. Reported figures come from here."""
    return WriteResult(
        lexemes=await connection.fetchval("SELECT count(*) FROM lexicon") or 0,
        words=await connection.fetchval(
            "SELECT count(*) FROM verse_words WHERE source_id = $1",
            plan.word_source_id,
        )
        or 0,
        alignments=await connection.fetchval(
            "SELECT count(*) FROM verse_word_alignments WHERE source_id = $1",
            plan.alignment_source_id,
        )
        or 0,
        usage_rows=await connection.fetchval(
            "SELECT count(*) FROM lexicon_usage WHERE source_id = $1",
            plan.word_source_id,
        )
        or 0,
    )
