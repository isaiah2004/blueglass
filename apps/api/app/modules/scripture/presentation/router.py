"""HTTP routes for the scripture read API -- the M1 core.

Purpose
    Expose the four reads the reading canvas needs, with one documented failure
    code per way each can fail. Route functions do no work beyond mapping: they
    call a use case and map the result, so every rule lives somewhere testable
    without HTTP.

Routes
    GET /translations
    GET /books
    GET /chapters/{translation}/{book}/{chapter}
    GET /search

Relationship to the prototype
    The prototype served GET /read/{book}/{chapter} and GET /search/scripture
    (flutter-port-map.md section 5, endpoints 1 and 6). The paths here are new
    -- translation is part of the chapter address rather than a query parameter,
    because it identifies the resource -- while the response bodies keep the
    prototype's field names so the ported reader consumes them unchanged.

Dependencies
    FastAPI, the scripture use cases via the container, the wire schemas.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query

from ....presentation_dependencies import ContainerDep
from . import schemas

router = APIRouter(tags=["scripture"])


@router.get(
    "/translations",
    response_model=schemas.TranslationListOut,
    summary="Translations that have verses loaded",
)
async def list_translations(container: ContainerDep) -> schemas.TranslationListOut:
    """Only translations with verses are listed: an empty one would render a
    switcher entry that opens to a blank chapter."""
    translations = await container.list_translations()
    return schemas.to_translation_list(list(translations))


@router.get(
    "/books",
    response_model=schemas.BookListOut,
    summary="The 66-book canon",
)
async def list_books(container: ContainerDep) -> schemas.BookListOut:
    """Served from the domain table, so it answers correctly even against an
    empty database."""
    return schemas.to_book_list(list(container.list_books()))


@router.get(
    "/chapters/{translation}/{book}/{chapter}",
    response_model=schemas.ChapterOut,
    summary="Every verse of one chapter",
    responses={
        404: {"description": "book_not_found, translation_not_found, chapter_not_found"},
        422: {"description": "chapter_out_of_range, or a non-numeric chapter"},
    },
)
async def get_chapter(
    container: ContainerDep,
    translation: Annotated[str, Path(description="Translation code, e.g. BSB.")],
    book: Annotated[str, Path(description="Name, OSIS code, alias, or number.")],
    chapter: Annotated[int, Path(ge=1, description="1-based chapter number.")],
) -> schemas.ChapterOut:
    """The book token is tolerant: Proverbs, Prov, prov, 1cor, sos and 20 all
    resolve, exactly as they did in the prototype."""
    result = await container.get_chapter(translation=translation, book=book, chapter=chapter)
    return schemas.to_chapter(result)


@router.get(
    "/search",
    response_model=schemas.SearchOut,
    summary="Full-text scripture search",
    responses={
        404: {"description": "book_not_found (bad scope), translation_not_found"},
        422: {"description": "query_too_short"},
    },
)
async def search(
    container: ContainerDep,
    q: Annotated[str, Query(description="What to search for.")],
    translation: Annotated[str | None, Query(description="Defaults to BSB.")] = None,
    scope: Annotated[
        str,
        Query(description="all, or a book token to search one book."),
    ] = "all",
    limit: Annotated[int | None, Query(ge=1, description="Rows to return.")] = None,
) -> schemas.SearchOut:
    """Indexed full-text match, with a trigram fallback for queries the English
    configuration reduces to nothing."""
    result = await container.search_verses(
        query=q,
        translation=translation or container.settings.default_translation,
        scope=scope,
        limit=limit,
    )
    return schemas.to_search(result)
