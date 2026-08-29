"""Postgres implementation of the StudyRepository port."""

from __future__ import annotations

import asyncpg

from ....infrastructure.db import Database
from ..domain import ChapterStudy

_GET = """
    SELECT book_number, chapter, content, model, origin, author_subject, updated_at
    FROM chapter_studies
    WHERE book_number = $1 AND chapter = $2
"""

_SAVE = """
    INSERT INTO chapter_studies
        (book_number, chapter, content, model, origin, author_subject)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (book_number, chapter) DO UPDATE SET
        content = $3,
        model = $4,
        origin = $5,
        author_subject = $6,
        updated_at = now()
    RETURNING book_number, chapter, content, model, origin, author_subject, updated_at
"""


class PostgresStudyRepository:
    """Stores chapter study content in Postgres."""

    def __init__(self, database: Database) -> None:
        self._db = database

    async def get(self, book_number: int, chapter: int) -> ChapterStudy | None:
        row = await self._db.fetchrow(_GET, book_number, chapter)
        return None if row is None else self._to_study(row)

    async def save(self, study: ChapterStudy) -> ChapterStudy:
        row = await self._db.fetchrow(
            _SAVE,
            study.book_number,
            study.chapter,
            study.content,
            study.model,
            study.origin,
            study.author_subject,
        )
        assert row is not None
        return self._to_study(row)

    @staticmethod
    def _to_study(row: asyncpg.Record) -> ChapterStudy:
        record = dict(row)
        return ChapterStudy(
            book_number=record["book_number"],
            chapter=record["chapter"],
            content=dict(record["content"]),
            model=record["model"],
            origin=record["origin"],
            author_subject=record["author_subject"],
            updated_at=record["updated_at"],
        )
