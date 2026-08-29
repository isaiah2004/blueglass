"""An in-memory BadgeRepository over the Acts 16 fixture chapter.

Purpose
    Let every badge endpoint be tested with no database. The double exists
    because the port exists; a service that reached for asyncpg from its routes
    could not have one.

Fidelity
    This is a double, not a simulation. It implements `load_chapter` and
    nothing more. That the SQL behind the real adapter is valid, and that the
    Acts 16 it returns is the Acts 16 the datasets describe, is covered by
    `tests/integration/test_badges_live.py` against real Postgres.

The chapter it serves
    `badge_fixture.py`. Kept in its own module so that the rows a test asserts
    against can be read without scrolling past the repository, and so neither
    file approaches rule 5.4.2's 300-line cap.
"""

from __future__ import annotations

from app.modules.badges.domain import ChapterBadgeData, VerseText
from tests.contract.badge_fixture import (
    BARE_CHAPTER,
    BOOK_ACTS,
    CHAPTER,
    SOURCES,
    fixture_chapter,
)


class InMemoryBadgeRepository:
    """Serves one fixture chapter and an empty aggregate for anything else."""

    def __init__(self) -> None:
        self.chapter = fixture_chapter()
        #: Every (translation, book, chapter) asked for, in order. Lets a test
        #: prove the endpoint issues exactly one load per request.
        self.calls: list[tuple[str, int, int]] = []

    async def load_chapter(
        self, *, translation: str, book_number: int, chapter: int
    ) -> ChapterBadgeData:
        self.calls.append((translation, book_number, chapter))
        if book_number == BOOK_ACTS and chapter == CHAPTER and translation == "BSB":
            return self.chapter
        if book_number == BOOK_ACTS and chapter == BARE_CHAPTER and translation == "BSB":
            return ChapterBadgeData(
                translation=translation,
                book_number=book_number,
                chapter=chapter,
                verses=(VerseText(44017001, 1, "Acts.17.1", "They passed through."),),
                sources=dict(SOURCES),
            )
        return ChapterBadgeData(
            translation=translation, book_number=book_number, chapter=chapter
        )
