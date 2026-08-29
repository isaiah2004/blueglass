"""Use case: every badge one chapter renders, with its provenance.

Purpose
    The endpoint the reading canvas calls alongside the chapter itself. One
    call, one round of queries, one fully-formed answer -- no second request
    per badge, no waterfall.

Failure modes, and the one code they share
    A chapter with verses but no enrichment returns an EMPTY list. That is a
    successful answer to a reasonable question, not a 404, and treating it as
    an error would make every unenriched chapter in the canon look broken.
    A chapter with no verses at all -- a bad translation code, a chapter past
    the end of the book -- is `chapter_not_found`. The scripture endpoint
    already distinguishes those two causes precisely; repeating that
    distinction here would mean a second query to say something the client can
    already find out.

Dependencies
    The badge domain, the scripture domain's book lookup, the shared error
    vocabulary, and the repository port. No framework, no driver.
"""

from __future__ import annotations

from dataclasses import dataclass

from ....shared.errors import NotFoundError
from ...scripture.domain import Book, require_book
from ..domain import InlineBadge, SourceAttribution
from ..domain.assembly import assemble_chapter_badges, cited_sources
from .ports import BadgeRepository


@dataclass(frozen=True, slots=True)
class ChapterBadges:
    """One chapter's badges, plus the attribution strip they oblige."""

    translation: str
    book: Book
    chapter: int
    badges: tuple[InlineBadge, ...]
    sources: tuple[SourceAttribution, ...]

    @property
    def reference(self) -> str:
        """Human reference, e.g. "Acts 16"."""
        return f"{self.book.name} {self.chapter}"


class GetChapterBadges:
    """Assemble the inline badges for one chapter of one translation."""

    def __init__(self, repository: BadgeRepository) -> None:
        self._repository = repository

    async def __call__(self, *, translation: str, book: str, chapter: int) -> ChapterBadges:
        """Load, build, select.

        @param translation: Translation code, e.g. BSB. Anchors are offsets into
            THIS translation's text, so the code is part of the question.
        @param book: Name, OSIS code, alias or number -- resolved as tolerantly
            as the scripture endpoint resolves it.
        @param chapter: 1-based chapter number.
        @returns The chapter's badges in reading order, with their sources.
        @raises NotFoundError: `book_not_found` for an unresolvable book token,
            `chapter_not_found` when the chapter has no verses in this
            translation.
        """
        resolved = require_book(book)
        data = await self._repository.load_chapter(
            translation=translation, book_number=resolved.book_number, chapter=chapter
        )
        if data.is_empty:
            raise NotFoundError(
                f"No verses for {resolved.name} {chapter} in {translation}.",
                code="chapter_not_found",
                details={
                    "translation": translation,
                    "book": resolved.osis,
                    "chapter": chapter,
                },
            )
        badges = assemble_chapter_badges(data)
        return ChapterBadges(
            translation=data.translation,
            book=resolved,
            chapter=chapter,
            badges=tuple(badges),
            sources=cited_sources(badges),
        )
