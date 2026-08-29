"""Postgres implementation of the ScriptureRepository port.

Purpose
    Turn rows into domain objects and nothing else. No business rules live here:
    which failure code a missing chapter deserves is the use case's decision,
    so this adapter returns None and lets the use case name it.

Dependencies
    The shared Database wrapper and the scripture domain. Implements the port
    declared in ../application/ports.py.

Usage
    repository = PostgresScriptureRepository(database, default_translation="BSB")
"""

from __future__ import annotations

from collections.abc import Sequence

import asyncpg

from ....infrastructure.db import Database
from ..domain import BY_NUMBER, Chapter, SearchHit, Translation, Verse
from . import scripture_sql as sql


class PostgresScriptureRepository:
    """Reads scripture from Postgres."""

    def __init__(self, database: Database, *, default_translation: str) -> None:
        self._db = database
        self._default_translation = default_translation

    async def list_translations(self) -> Sequence[Translation]:
        rows = await self._db.fetch(sql.LIST_TRANSLATIONS, self._default_translation)
        return [
            Translation(
                code=row["code"],
                name=row["name"] or row["code"],
                language=row["language"],
                can_redistribute=row["can_redistribute"],
            )
            for row in rows
        ]

    async def translation_exists(self, code: str) -> bool:
        async with self._db.acquire() as connection:
            return bool(await connection.fetchval(sql.TRANSLATION_EXISTS, code))

    async def get_chapter(
        self, translation: str, book_number: int, chapter: int
    ) -> Chapter | None:
        rows = await self._db.fetch(sql.GET_CHAPTER, translation, book_number, chapter)
        if not rows:
            return None
        return Chapter(
            translation=translation,
            book=BY_NUMBER[book_number],
            chapter=chapter,
            verses=tuple(
                Verse(
                    verse=row["verse"],
                    text=row["text"],
                    osis_id=row["osis_id"],
                    verse_key=row["verse_key"],
                )
                for row in rows
            ),
        )

    async def search_verses(
        self,
        *,
        query: str,
        translation: str,
        book_number: int | None,
        limit: int,
    ) -> Sequence[SearchHit]:
        async with self._db.acquire() as connection:
            statement = await self._choose_statement(connection, query)
            rows = await connection.fetch(statement, translation, query, book_number, limit)
        return [self._to_hit(row) for row in rows]

    @staticmethod
    async def _choose_statement(connection: asyncpg.Connection, query: str) -> str:
        """Pick full-text or trigram matching for this query.

        A query that reduces to an empty tsquery -- a stop word, or a prefix the
        user is still typing -- would return nothing at all from the full-text
        statement. Detecting that up front costs one cheap call and keeps the
        search overlay from flashing empty.
        """
        empty = await connection.fetchval(sql.TSQUERY_IS_EMPTY, query)
        return sql.SEARCH_VERSES_TRIGRAM if empty else sql.SEARCH_VERSES

    @staticmethod
    def _to_hit(row: asyncpg.Record) -> SearchHit:
        book = BY_NUMBER[row["book_number"]]
        return SearchHit(
            book_number=row["book_number"],
            chapter=row["chapter"],
            verse=row["verse"],
            text=row["text"],
            osis_id=row["osis_id"],
            verse_key=row["verse_key"],
            reference=f"{book.name} {row['chapter']}:{row['verse']}",
        )
