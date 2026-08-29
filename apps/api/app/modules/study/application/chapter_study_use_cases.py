"""Use cases: read and write chapter study content.

Purpose
    Defect 2 in DECISIONS.md section 4: in the prototype
    PUT /study/{book}/{chapter} is an unauthenticated write that ALSO injects
    its body into the retrieval index. Anyone who could reach the port could
    poison what the grounded-chat surface cites -- a direct pillar-3 breach.

    SaveChapterStudy therefore takes an Identity as its first argument. It is
    not optional and there is no default, so a route that forgets to require one
    does not compile past review: it cannot call this use case at all.

Dependencies
    The study ports and domain, the identity domain, the scripture domain for
    book resolution.

Usage
    await SaveChapterStudy(repository)(identity, book="prov", chapter=1, content={...})
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ....shared.errors import NotFoundError, ValidationError
from ...identity.domain import Identity
from ...scripture.domain import require_book
from ..domain import ChapterStudy
from .ports import AuthorRegistry, StudyRepository


def _resolve_chapter(book: str, chapter: int) -> tuple[int, str]:
    """Resolve a book token and bounds-check the chapter against the canon."""
    resolved = require_book(book)
    if not 1 <= chapter <= resolved.chapter_count:
        raise ValidationError(
            f"{resolved.name} has {resolved.chapter_count} chapters; "
            f"{chapter} is out of range.",
            code="chapter_out_of_range",
            details={"book": resolved.name, "chapter": chapter},
        )
    return resolved.book_number, resolved.name


class GetChapterStudy:
    """Read the study content for a chapter."""

    def __init__(self, repository: StudyRepository) -> None:
        self._repository = repository

    async def __call__(self, *, book: str, chapter: int) -> ChapterStudy:
        book_number, name = _resolve_chapter(book, chapter)
        found = await self._repository.get(book_number, chapter)
        if found is None:
            raise NotFoundError(
                f"No study content for {name} {chapter}.",
                code="study_not_found",
                details={"book": name, "chapter": chapter},
            )
        return found


class SaveChapterStudy:
    """Write the study content for a chapter. Requires an identity."""

    def __init__(self, repository: StudyRepository, authors: AuthorRegistry) -> None:
        self._repository = repository
        self._authors = authors

    async def __call__(
        self,
        identity: Identity,
        *,
        book: str,
        chapter: int,
        content: Mapping[str, Any],
        model: str | None = None,
    ) -> ChapterStudy:
        book_number, _ = _resolve_chapter(book, chapter)
        if not content:
            raise ValidationError(
                "Study content must not be empty.", code="empty_study_content"
            )
        # The row's author is a foreign key, so the author must exist first.
        await self._authors.ensure(identity)
        return await self._repository.save(
            ChapterStudy(
                book_number=book_number,
                chapter=chapter,
                content=dict(content),
                model=model,
                origin="generated" if model else "authored",
                author_subject=identity.subject,
            )
        )
