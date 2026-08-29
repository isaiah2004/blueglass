"""HTTP routes for the inline badge API -- the M2 core.

Purpose
    Two reads, with one documented failure code per way each can fail. Route
    functions do no work beyond mapping: they call a use case and map the
    result, so every rule lives somewhere testable without HTTP.

Routes
    GET /badges/chapters/{translation}/{book}/{chapter}
    GET /badges/{badge_id}

Why two, and not five or one
    ONE chapter endpoint, because the reading canvas asks "what does Acts 16
    show?" -- never "what Route badges does Acts 16 have?". Five per-kind
    endpoints would be the waterfall the milestone brief forbids, and would
    push the per-verse cap into client code no server test covers. The payload
    union is discriminated on `kind`, so one response type is already the
    modelled shape in `packages/shared/src/badges.ts`.

    PLUS a by-id endpoint, because a sheet reopened from a deep link or after a
    cache eviction should not have to refetch a whole chapter to find one
    payload. It costs nothing extra: badge ids are derived from the badge's own
    coordinates, so the id alone rebuilds it.

Dependencies
    FastAPI, the badge use cases via the container, the wire schemas.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query

from ....presentation_dependencies import ContainerDep
from . import mappers, schemas

router = APIRouter(prefix="/badges", tags=["badges"])


@router.get(
    "/chapters/{translation}/{book}/{chapter}",
    response_model=schemas.ChapterBadgesOut,
    summary="Every inline badge one chapter renders",
    responses={
        404: {"description": "book_not_found, chapter_not_found"},
        422: {"description": "a non-numeric or non-positive chapter"},
    },
)
async def get_chapter_badges(
    container: ContainerDep,
    translation: Annotated[str, Path(description="Translation code, e.g. BSB.")],
    book: Annotated[str, Path(description="Name, OSIS code, alias, or number.")],
    chapter: Annotated[int, Path(ge=1, description="1-based chapter number.")],
) -> schemas.ChapterBadgesOut:
    """The chapter's badges, anchored and fully paid up on provenance.

    A chapter that exists but carries no enrichment returns an empty `badges`
    list and a 200. That is the honest answer for most of the canon today, and
    a 404 would make the reader's client treat an unenriched chapter as broken.
    """
    result = await container.get_chapter_badges(
        translation=translation, book=book, chapter=chapter
    )
    return mappers.to_chapter_badges(result)


@router.get(
    "/{badge_id}",
    response_model=schemas.BadgeOut,
    summary="One badge, rebuilt from its id",
    responses={
        404: {"description": "badge_not_found"},
        422: {"description": "badge_id_malformed"},
    },
)
async def get_badge(
    container: ContainerDep,
    badge_id: Annotated[
        str, Path(description="kind~verse_key~discriminator, as returned by the chapter read.")
    ],
    translation: Annotated[
        str | None,
        Query(description="Translation the anchor offsets belong to. Defaults to BSB."),
    ] = None,
) -> schemas.BadgeOut:
    """Rebuild one badge.

    The translation matters: an anchor is a character range, and the same word
    sits at different offsets in KJV and BSB. Omitting it uses the service
    default rather than guessing from the id, which carries no translation.
    """
    badge = await container.get_badge(
        badge_id=badge_id,
        translation=translation or container.settings.default_translation,
    )
    return mappers.to_badge(badge)
