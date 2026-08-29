"""The migrated schema is what the code assumes it is.

A migration file is a claim. These tests read the live catalog and check it.
"""

from __future__ import annotations

import asyncpg
import pytest

pytestmark = pytest.mark.integration

_EXPECTED_TABLES = {
    "alembic_version",
    "chapter_studies",
    "data_sources",
    "embeddings",
    "identities",
    "identity_preferences",
    "passages",
    "translations",
    "verses",
}


async def test_every_expected_table_exists(connection: asyncpg.Connection) -> None:
    rows = await connection.fetch(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    )
    present = {row["tablename"] for row in rows}

    assert _EXPECTED_TABLES <= present


async def test_migrations_are_at_head(connection: asyncpg.Connection) -> None:
    version = await connection.fetchval("SELECT version_num FROM alembic_version")

    assert version == "0003"


async def test_both_q009_shapes_exist(connection: asyncpg.Connection) -> None:
    """Decision Q-009: BOTH verse rows and passage rows, denormalised."""
    rows = await connection.fetch(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    )
    present = {row["tablename"] for row in rows}

    assert {"verses", "passages"} <= present


async def test_the_search_indexes_exist(connection: asyncpg.Connection) -> None:
    """The prototype's leading-wildcard ILIKE could not use an index at all."""
    rows = await connection.fetch(
        "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'verses'"
    )
    definitions = {row["indexname"]: row["indexdef"] for row in rows}

    assert "gin" in definitions["verses_tsv_idx"].lower()
    assert "gin_trgm_ops" in definitions["verses_trgm_idx"]


async def test_the_verse_tsvector_is_generated_not_stored_by_hand(
    connection: asyncpg.Connection,
) -> None:
    """A generated column cannot drift from the text it indexes."""
    generated = await connection.fetchval(
        "SELECT is_generated FROM information_schema.columns "
        "WHERE table_name = 'verses' AND column_name = 'text_tsv'"
    )

    assert generated == "ALWAYS"


async def test_a_verse_row_cannot_name_a_book_outside_the_canon(
    connection: asyncpg.Connection,
) -> None:
    """Port-map risk 10 produced book_number 0 rows. The database refuses them."""
    await connection.execute(
        "INSERT INTO translations (code, name) VALUES ('TEST', 'Test') ON CONFLICT DO NOTHING"
    )
    with pytest.raises(asyncpg.CheckViolationError):
        await connection.execute(
            "INSERT INTO verses (verse_key, translation, book_number, chapter, "
            "verse, osis_id, text) VALUES (1, 'TEST', 0, 1, 1, 'X.1.1', 'x')"
        )


async def test_a_study_row_must_name_its_author(
    connection: asyncpg.Connection,
) -> None:
    """Defect 2 at the schema level: an unattributable claim cannot be stored."""
    with pytest.raises(asyncpg.NotNullViolationError):
        await connection.execute(
            "INSERT INTO chapter_studies (book_number, chapter, content) "
            "VALUES (20, 1, '{}'::jsonb)"
        )
