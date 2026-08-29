"""The interfaces the badge use cases depend on.

Purpose
    Rule 5.1.1: dependencies flow inward. The use cases own this protocol; the
    Postgres adapter implements it. That inversion is what lets every contract
    test run against an in-memory double with no database, and it is what makes
    "the domain layer imports nothing from infrastructure" checkable rather
    than aspirational.

The single-method shape is the performance decision
    `load_chapter` fetches every table the five badges read in one call. The
    brief's rule is that a chapter's badges arrive WITH the chapter, not after
    a waterfall; a port with five methods would invite five round trips and
    five sequence points. One method makes the batched shape the only shape.

Dependencies
    typing.Protocol and the badge domain. No driver, no framework.
"""

from __future__ import annotations

from typing import Protocol

from ..domain import ChapterBadgeData


class BadgeRepository(Protocol):
    """Read access to everything one chapter's badges are built from."""

    async def load_chapter(
        self, *, translation: str, book_number: int, chapter: int
    ) -> ChapterBadgeData:
        """Every badge input for one chapter, in one round of queries.

        Returns an EMPTY aggregate rather than raising when the chapter has no
        verses in this translation: "no data" is a valid answer to a valid
        question, and deciding whether that is a 404 is the use case's job.
        """
        ...
