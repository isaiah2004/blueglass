"""Ports the study use cases depend on."""

from __future__ import annotations

from typing import Protocol

from ...identity.domain import Identity
from ..domain import ChapterStudy


class StudyRepository(Protocol):
    """Storage for chapter study content."""

    async def get(self, book_number: int, chapter: int) -> ChapterStudy | None:
        """The stored study for a chapter, or None."""
        ...

    async def save(self, study: ChapterStudy) -> ChapterStudy:
        """Insert or replace a chapter study and return what was stored."""
        ...


class AuthorRegistry(Protocol):
    """Guarantees an author exists before their work is attributed to them.

    A study row's author_subject is a foreign key to the identities table, so a
    device writing its first study before it has written anything else would
    otherwise fail on the constraint. This module declares the narrow capability
    it needs rather than importing the identity repository; the composition root
    binds the identity module's repository to it.
    """

    async def ensure(self, identity: Identity) -> None:
        """Record the identity if it is new. Idempotent."""
        ...
