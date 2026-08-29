"""In-memory implementations of the repository ports.

Purpose
    Let every endpoint be tested — success AND every documented failure code —
    without a database, in milliseconds. They exist because the ports exist; a
    service that reached for the driver from its routes could not have them.

Fidelity
    These are doubles, not simulations. They implement the port contract and
    nothing more: the SQL they stand in for is covered by the integration tests
    in tests/integration/, which run against real Postgres.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from app.modules.identity.domain import Identity
from app.modules.scripture.domain import (
    BY_NUMBER,
    Chapter,
    SearchHit,
    Translation,
    Verse,
    osis_id_for,
    verse_key,
)
from app.modules.study.domain import ChapterStudy

#: Two verses of Proverbs 1 and one of John 3, enough to exercise every read.
FIXTURE_TRANSLATIONS: tuple[Translation, ...] = (
    Translation(
        code="BSB",
        name="Berean Standard Bible",
        language="en",
        can_redistribute=True,
    ),
    Translation(
        code="ASV",
        name="American Standard Version",
        language="en",
        can_redistribute=True,
    ),
)

_FIXTURE_TEXT: tuple[tuple[int, int, int, str], ...] = (
    (20, 1, 1, "The proverbs of Solomon the son of David, king of Israel;"),
    (20, 1, 2, "To know wisdom and instruction; to perceive the words of understanding;"),
    (43, 3, 16, "For God so loved the world, that he gave his only begotten Son."),
)


def _fixture_verses() -> list[tuple[int, int, int, str]]:
    return list(_FIXTURE_TEXT)


class InMemoryScriptureRepository:
    """Scripture reads, served from a handful of real verses."""

    def __init__(self) -> None:
        self.translations = list(FIXTURE_TRANSLATIONS)
        self.rows = _fixture_verses()

    async def list_translations(self) -> Sequence[Translation]:
        return self.translations

    async def translation_exists(self, code: str) -> bool:
        return any(item.code == code for item in self.translations)

    async def get_chapter(
        self, translation: str, book_number: int, chapter: int
    ) -> Chapter | None:
        matches = [row for row in self.rows if row[0] == book_number and row[1] == chapter]
        if not matches:
            return None
        return Chapter(
            translation=translation,
            book=BY_NUMBER[book_number],
            chapter=chapter,
            verses=tuple(
                Verse(
                    verse=verse,
                    text=text,
                    osis_id=osis_id_for(book, chap, verse),
                    verse_key=verse_key(book, chap, verse),
                )
                for book, chap, verse, text in matches
            ),
        )

    async def search_verses(
        self, *, query: str, translation: str, book_number: int | None, limit: int
    ) -> Sequence[SearchHit]:
        needle = query.lower()
        hits = [
            self._to_hit(row)
            for row in self.rows
            if needle in row[3].lower() and (book_number is None or row[0] == book_number)
        ]
        return hits[:limit]

    @staticmethod
    def _to_hit(row: tuple[int, int, int, str]) -> SearchHit:
        book, chapter, verse, text = row
        return SearchHit(
            book_number=book,
            chapter=chapter,
            verse=verse,
            text=text,
            osis_id=osis_id_for(book, chapter, verse),
            verse_key=verse_key(book, chapter, verse),
            reference=f"{BY_NUMBER[book].name} {chapter}:{verse}",
        )


class InMemoryIdentityRepository:
    """Identities and their preferences, keyed by subject."""

    def __init__(self) -> None:
        self.subjects: set[str] = set()
        self.preferences: dict[str, dict[str, Any]] = {}

    async def ensure(self, identity: Identity) -> None:
        self.subjects.add(identity.subject)

    async def get_preferences(self, identity: Identity) -> dict[str, Any]:
        return dict(self.preferences.get(identity.subject, {}))

    async def set_preferences(
        self, identity: Identity, preferences: Mapping[str, Any]
    ) -> dict[str, Any]:
        self.preferences[identity.subject] = dict(preferences)
        return dict(preferences)


class InMemoryStudyRepository:
    """Chapter study content, keyed by (book_number, chapter)."""

    def __init__(self) -> None:
        self.studies: dict[tuple[int, int], ChapterStudy] = {}

    async def get(self, book_number: int, chapter: int) -> ChapterStudy | None:
        return self.studies.get((book_number, chapter))

    async def save(self, study: ChapterStudy) -> ChapterStudy:
        self.studies[(study.book_number, study.chapter)] = study
        return study
