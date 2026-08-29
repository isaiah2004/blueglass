"""The word-layer schema, proved against the real Postgres.

These are the things a double cannot show: that the DDL parses, that the indexes
the Root sheet's queries assume actually exist, and that the constraints refuse
the rows they were written to refuse. Every test runs in a rolled-back
transaction, so it is safe against a database with the real corpus loaded.
"""

from __future__ import annotations

import asyncpg
import pytest

pytestmark = pytest.mark.integration

_TABLES = ("lexicon", "verse_words", "verse_word_alignments", "lexicon_usage")


async def _index_names(connection: asyncpg.Connection, table: str) -> set[str]:
    rows = await connection.fetch(
        "SELECT indexname FROM pg_indexes WHERE tablename = $1", table
    )
    return {row["indexname"] for row in rows}


@pytest.mark.parametrize("table", _TABLES)
async def test_every_word_layer_table_exists(
    connection: asyncpg.Connection, table: str
) -> None:
    assert await connection.fetchval("SELECT to_regclass($1)", table) == table


async def test_the_indexes_the_root_sheet_depends_on_exist(
    connection: asyncpg.Connection,
) -> None:
    """Tapping a word looks up by verse; the usage strip looks up by lemma."""
    assert "verse_words_key_idx" in await _index_names(connection, "verse_words")
    assert "verse_words_strongs_idx" in await _index_names(connection, "verse_words")
    assert "lexicon_simple_idx" in await _index_names(connection, "lexicon")


async def test_a_definition_without_a_source_is_rejected_by_the_database(
    connection: asyncpg.Connection,
) -> None:
    """AI-05 is a constraint, not a convention: a claim with no provenance
    cannot be stored, so it can never be rendered."""
    with pytest.raises(asyncpg.IntegrityConstraintViolationError):
        await connection.execute(
            """
            INSERT INTO lexicon (strongs, simple_strongs, lang, lemma, definition,
                                 source_id)
            VALUES ('G9999', 'G9999', 'greek', 'test', 'unsourced claim',
                    (SELECT id FROM data_sources LIMIT 1))
            """
        )


async def test_an_unknown_language_is_rejected(connection: asyncpg.Connection) -> None:
    with pytest.raises(asyncpg.IntegrityConstraintViolationError):
        await connection.execute(
            """
            INSERT INTO lexicon (strongs, simple_strongs, lang, lemma, source_id)
            VALUES ('G9999', 'G9999', 'latin', 'test',
                    (SELECT id FROM data_sources LIMIT 1))
            """
        )


async def test_a_word_cannot_cite_a_strongs_number_no_lexeme_covers(
    connection: asyncpg.Connection,
) -> None:
    with pytest.raises(asyncpg.ForeignKeyViolationError):
        await connection.execute(
            """
            INSERT INTO verse_words (verse_key, word_index, surface, strongs, source_id)
            VALUES (44016014, 99, 'x', 'G0000000',
                    (SELECT id FROM data_sources LIMIT 1))
            """
        )


async def test_one_english_word_can_only_point_at_one_original_word(
    connection: asyncpg.Connection,
) -> None:
    """The primary key is what stops a re-run doubling a verse's alignments."""
    row = await connection.fetchrow(
        "SELECT translation, verse_key, token_index FROM verse_word_alignments LIMIT 1"
    )
    if row is None:
        pytest.skip("no alignments loaded; run scripts.ingest_lexicon")
    with pytest.raises(asyncpg.UniqueViolationError):
        await connection.execute(
            """
            INSERT INTO verse_word_alignments
                (translation, verse_key, token_index, token, char_start, char_end,
                 verse_word_id, method, confidence, source_id)
            SELECT $1, $2, $3, 'x', 0, 1, id, 'gloss-exact', 1.0, source_id
              FROM verse_words LIMIT 1
            """,
            row["translation"],
            row["verse_key"],
            row["token_index"],
        )


async def test_data_sources_records_a_retrieval_date(
    connection: asyncpg.Connection,
) -> None:
    """The brief requires source, licence AND retrieval date in the database."""
    assert await connection.fetchval(
        """
        SELECT count(*) FROM information_schema.columns
         WHERE table_name = 'data_sources' AND column_name = 'retrieved_at'
        """
    )
