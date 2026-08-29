"""HTTP routes for chapter study content.

Purpose
    Port endpoint 7 of the port map, and close defect 2 from DECISIONS.md
    section 4: in the prototype, PUT /study/{book}/{chapter} was an
    UNAUTHENTICATED write whose body was also injected into the retrieval index.

    The write here requires an identity. The read does not: study content is
    public, and requiring a header to read it would break caching for no gain.

Routes
    GET /study/{book}/{chapter}   public read, 404 when absent
    PUT /study/{book}/{chapter}   requires an identity

Retrieval indexing
    Deliberately NOT performed inside this request. Writing to the index from an
    unauthenticated public endpoint was the prototype's mistake; doing it inside
    a request at all makes an HTTP write silently expensive. Indexing is a build
    step over the stored rows.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Path
from pydantic import BaseModel, Field

from ....presentation_dependencies import ContainerDep, CurrentIdentity

router = APIRouter(prefix="/study", tags=["study"])


class StudyOut(BaseModel):
    """A stored chapter study."""

    book_number: int
    chapter: int
    model: str | None = Field(description="Model that generated it, if any.")
    origin: str = Field(description="sourced, generated, or authored.")
    content: dict[str, Any]


class StudyIn(BaseModel):
    """The body of a study write."""

    content: dict[str, Any] = Field(description="The study object; must not be empty.")
    model: str | None = Field(
        default=None, description="Model id, when the content was generated."
    )


BookPath = Annotated[str, Path(description="Name, OSIS code, alias, or number.")]
ChapterPath = Annotated[int, Path(ge=1, description="1-based chapter number.")]


@router.get(
    "/{book}/{chapter}",
    response_model=StudyOut,
    responses={404: {"description": "book_not_found or study_not_found"}},
)
async def get_study(container: ContainerDep, book: BookPath, chapter: ChapterPath) -> StudyOut:
    """Study content for a chapter. 404 means there is none yet, not an error."""
    study = await container.get_chapter_study(book=book, chapter=chapter)
    return StudyOut(
        book_number=study.book_number,
        chapter=study.chapter,
        model=study.model,
        origin=study.origin,
        content=study.content,
    )


@router.put(
    "/{book}/{chapter}",
    response_model=StudyOut,
    responses={
        401: {"description": "identity_required -- this write is NOT anonymous"},
        404: {"description": "book_not_found"},
        422: {"description": "empty_study_content or chapter_out_of_range"},
    },
)
async def put_study(
    container: ContainerDep,
    identity: CurrentIdentity,
    book: BookPath,
    chapter: ChapterPath,
    body: StudyIn,
) -> StudyOut:
    """Write study content. The identity is recorded on the row as its author."""
    study = await container.save_chapter_study(
        identity, book=book, chapter=chapter, content=body.content, model=body.model
    )
    return StudyOut(
        book_number=study.book_number,
        chapter=study.chapter,
        model=study.model,
        origin=study.origin,
        content=study.content,
    )
