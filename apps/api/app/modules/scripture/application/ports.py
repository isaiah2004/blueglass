"""The interfaces the scripture use cases depend on.

Purpose
    Rule 5.1.1: dependencies flow inward. The use cases below own these
    protocols; the Postgres adapter in infrastructure/ implements them. That
    inversion is what lets the endpoint tests run against an in-memory double
    with no database, and it is what would let the store change without the use
    cases noticing.

Dependencies
    typing.Protocol and the scripture domain. No driver, no framework.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from ..domain import Chapter, SearchHit, Translation


class ScriptureRepository(Protocol):
    """Read access to the scripture corpus."""

    async def list_translations(self) -> Sequence[Translation]:
        """Translations that actually have verses loaded, preferred first."""
        ...

    async def translation_exists(self, code: str) -> bool:
        """True when the code names a translation with verses loaded."""
        ...

    async def get_chapter(
        self, translation: str, book_number: int, chapter: int
    ) -> Chapter | None:
        """A whole chapter in verse order, or None when it has no verses."""
        ...

    async def search_verses(
        self,
        *,
        query: str,
        translation: str,
        book_number: int | None,
        limit: int,
    ) -> Sequence[SearchHit]:
        """Verses matching the query, most relevant first."""
        ...
