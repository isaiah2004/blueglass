"""The Postgres scripture adapter, against a live database.

These tests seed their own translation inside a rolled-back transaction, so they
pass whether or not real scripture has been loaded.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg
import pytest

from app.config import Settings
from app.infrastructure.db import Database
from app.modules.scripture.infrastructure import PostgresScriptureRepository

pytestmark = pytest.mark.integration

_FIXTURE = (
    (20_001_001, 20, 1, 1, "Prov.1.1", "The proverbs of Solomon the son of David."),
    (20_001_002, 20, 1, 2, "Prov.1.2", "To know wisdom and instruction."),
    (43_003_016, 43, 3, 16, "John.3.16", "For God so loved the world."),
)


async def _seed(connection: asyncpg.Connection) -> None:
    await connection.execute(
        "INSERT INTO translations (code, name) VALUES ('ITEST', 'Integration Test')"
    )
    for key, book, chapter, verse, osis, text in _FIXTURE:
        await connection.execute(
            "INSERT INTO verses (verse_key, translation, book_number, chapter, "
            "verse, osis_id, text) VALUES ($1, 'ITEST', $2, $3, $4, $5, $6)",
            key,
            book,
            chapter,
            verse,
            osis,
            text,
        )


class _SingleConnectionDatabase(Database):
    """A Database that hands out the test transaction's connection.

    Subclassing keeps the repository under test completely unmodified: it still
    calls fetch() and fetchrow() exactly as it does in production, and every
    write it triggers is rolled back with the enclosing transaction.
    """

    def __init__(self, settings: Settings, connection: asyncpg.Connection) -> None:
        super().__init__(settings)
        self._connection = connection

    async def fetch(self, query: str, *args: object) -> list[asyncpg.Record]:
        return await self._connection.fetch(query, *args)

    async def fetchrow(self, query: str, *args: object) -> asyncpg.Record | None:
        return await self._connection.fetchrow(query, *args)

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[asyncpg.Connection]:
        yield self._connection


@pytest.fixture
def repository(
    connection: asyncpg.Connection, live_database_url: str
) -> PostgresScriptureRepository:
    database = _SingleConnectionDatabase(Settings(database_url=live_database_url), connection)
    return PostgresScriptureRepository(database, default_translation="ITEST")


async def test_get_chapter_returns_verses_in_order(
    connection: asyncpg.Connection, repository: PostgresScriptureRepository
) -> None:
    await _seed(connection)

    chapter = await repository.get_chapter("ITEST", 20, 1)

    assert chapter is not None
    assert chapter.reference == "Proverbs 1"
    assert [verse.verse for verse in chapter.verses] == [1, 2]
    assert chapter.verses[0].verse_key == 20_001_001


async def test_get_chapter_is_none_when_empty(
    connection: asyncpg.Connection, repository: PostgresScriptureRepository
) -> None:
    await _seed(connection)

    assert await repository.get_chapter("ITEST", 20, 2) is None


async def test_full_text_search_finds_a_word(
    connection: asyncpg.Connection, repository: PostgresScriptureRepository
) -> None:
    """Proves the generated tsvector and the websearch match actually work."""
    await _seed(connection)

    hits = await repository.search_verses(
        query="wisdom", translation="ITEST", book_number=None, limit=10
    )

    assert [hit.reference for hit in hits] == ["Proverbs 1:2"]


async def test_search_is_scoped_by_book(
    connection: asyncpg.Connection, repository: PostgresScriptureRepository
) -> None:
    await _seed(connection)

    everywhere = await repository.search_verses(
        query="the", translation="ITEST", book_number=None, limit=10
    )
    john_only = await repository.search_verses(
        query="the", translation="ITEST", book_number=43, limit=10
    )

    assert len(everywhere) > len(john_only)
    assert all(hit.book_number == 43 for hit in john_only)


async def test_a_stop_word_query_falls_back_to_substring_matching(
    connection: asyncpg.Connection, repository: PostgresScriptureRepository
) -> None:
    """A lone stop word reduces to an empty tsquery. Without the fallback the
    search overlay would flash empty for a word in almost every verse."""
    await _seed(connection)

    hits = await repository.search_verses(
        query="the", translation="ITEST", book_number=None, limit=10
    )

    assert hits


async def test_translation_exists_only_when_verses_are_loaded(
    connection: asyncpg.Connection, repository: PostgresScriptureRepository
) -> None:
    await connection.execute(
        "INSERT INTO translations (code, name) VALUES ('EMPTY', 'No verses')"
    )
    await _seed(connection)

    assert await repository.translation_exists("ITEST") is True
    assert await repository.translation_exists("EMPTY") is False
