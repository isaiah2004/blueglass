"""Use case: one badge by id, for a sheet reopened from a link.

Purpose
    A reader taps a badge, the sheet opens, the app is backgrounded, the cache
    is evicted, the sheet is restored. Without this use case that restore needs
    the whole chapter response again just to find one payload. With it, the id
    the client already holds is enough.

Why this can exist at all
    Because badge ids are DERIVED, not stored (`domain/badge.py`). The id
    carries its own kind and verse, so the verse gives the book and chapter,
    and the same deterministic pipeline that produced the badge produces it
    again. If ids were surrogates from a table this endpoint would need a
    cache; because they are coordinates, it needs only arithmetic.

Consistency guarantee
    The badge is looked up in the SELECTED list, not in the raw candidates. An
    id that the chapter endpoint would not have returned is therefore a 404
    here too, so no link can surface a badge the reading canvas suppressed.

Dependencies
    The badge domain, the scripture domain's verse-key arithmetic, the shared
    error vocabulary, and the repository port. No framework, no driver.
"""

from __future__ import annotations

from ....shared.errors import NotFoundError, ValidationError
from ...scripture.domain import BY_NUMBER, split_verse_key
from ..domain import InlineBadge, parse_badge_id
from ..domain.assembly import assemble_chapter_badges
from .ports import BadgeRepository


class GetBadge:
    """Rebuild one badge from its id."""

    def __init__(self, repository: BadgeRepository) -> None:
        self._repository = repository

    async def __call__(self, *, badge_id: str, translation: str) -> InlineBadge:
        """Find the badge the id names.

        @param badge_id: `kind~verse_key~discriminator`, untrusted.
        @param translation: The translation the anchor offsets belong to. A
            badge is not translation-independent: the same word sits at
            different offsets in KJV and BSB.
        @returns The badge, exactly as the chapter endpoint would return it.
        @raises ValidationError: `badge_id_malformed` when the id does not parse
            or names a verse outside the canon.
        @raises NotFoundError: `badge_not_found` when the chapter builds no such
            badge -- which includes a badge the selection rules dropped.
        """
        parsed = parse_badge_id(badge_id)
        if parsed is None:
            raise ValidationError(
                "Badge id must be kind~verse_key~discriminator.",
                code="badge_id_malformed",
                details={"badge_id": badge_id},
            )
        book_number, chapter, _ = split_verse_key(parsed.verse_key)
        if book_number not in BY_NUMBER or chapter < 1:
            raise ValidationError(
                "Badge id names a verse outside the canon.",
                code="badge_id_malformed",
                details={"badge_id": badge_id},
            )
        data = await self._repository.load_chapter(
            translation=translation, book_number=book_number, chapter=chapter
        )
        for badge in assemble_chapter_badges(data):
            if str(badge.id) == badge_id:
                return badge
        raise NotFoundError(
            "No such badge in that chapter.",
            code="badge_not_found",
            details={"badge_id": badge_id, "translation": translation},
        )
