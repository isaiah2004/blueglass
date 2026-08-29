"""Use case: read one chapter.

Purpose
    The M1 core read. It resolves a tolerant book token, validates the chapter
    against the canon before touching the database, and distinguishes the three
    ways this call can legitimately fail so the client can say something useful
    instead of "404".

Failure modes, each with its own code
    book_not_found          the token names no book
    translation_not_found   the translation has no verses loaded
    chapter_out_of_range    the book has fewer chapters than that
    chapter_not_found       the chapter exists in the canon but not in this
                            translation (a partial load, not a client error)

Dependencies
    The ScriptureRepository port and the scripture domain.

Usage
    chapter = await GetChapter(repository)(translation="BSB", book="prov", chapter=1)
"""

from __future__ import annotations

from ....shared.errors import NotFoundError, ValidationError
from ..domain import Chapter, require_book
from .ports import ScriptureRepository


class GetChapter:
    """Fetch every verse of a chapter, in verse order."""

    def __init__(self, repository: ScriptureRepository) -> None:
        self._repository = repository

    async def __call__(self, *, translation: str, book: str, chapter: int) -> Chapter:
        resolved = require_book(book)
        self._check_chapter_in_range(resolved.name, resolved.chapter_count, chapter)
        await self._check_translation(translation)

        found = await self._repository.get_chapter(translation, resolved.book_number, chapter)
        if found is None:
            raise NotFoundError(
                f"No verses for {resolved.name} {chapter} in {translation}.",
                code="chapter_not_found",
                details={
                    "translation": translation,
                    "book": resolved.name,
                    "chapter": chapter,
                },
            )
        return found

    @staticmethod
    def _check_chapter_in_range(name: str, chapter_count: int, chapter: int) -> None:
        """Reject a chapter the canon does not contain, before any query."""
        if not 1 <= chapter <= chapter_count:
            raise ValidationError(
                f"{name} has {chapter_count} chapters; {chapter} is out of range.",
                code="chapter_out_of_range",
                details={
                    "book": name,
                    "chapter": chapter,
                    "chapter_count": chapter_count,
                },
            )

    async def _check_translation(self, translation: str) -> None:
        """Reject an unloaded translation with its own code.

        Without this the caller cannot tell a typo in the translation code from
        a chapter that genuinely has no text.
        """
        if not await self._repository.translation_exists(translation):
            raise NotFoundError(
                f"Unknown or unloaded translation: {translation!r}",
                code="translation_not_found",
                details={"translation": translation},
            )
