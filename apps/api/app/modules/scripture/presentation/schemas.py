"""Wire models for the scripture endpoints.

Purpose
    Keep the HTTP contract explicit and versionable. These models are what
    FastAPI publishes in the OpenAPI document, which is what the TypeScript
    client generates from -- so a field renamed here is a compile error there,
    not a runtime surprise.

Compatibility
    Field names follow the prototype (flutter-port-map.md section 5) so the
    ported reader consumes them unchanged: snake_case, verse_key as an int,
    osis_id as a string.

Dependencies
    Pydantic and the scripture domain (for the mappers only).
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from ...scripture.application import SearchResult
from ..domain import Book, Chapter, SearchHit, Translation


class TranslationOut(BaseModel):
    """One loaded translation."""

    code: str = Field(description="Stable code, e.g. BSB.")
    name: str
    language: str = Field(description="ISO 639-1 code.")
    can_redistribute: bool = Field(
        description="False for a licence that forbids shipping the text to a device."
    )


class TranslationListOut(BaseModel):
    """GET /translations."""

    translations: list[TranslationOut]


class BookOut(BaseModel):
    """One book of the canon."""

    book_number: int = Field(ge=1, le=66)
    name: str
    osis: str
    chapter_count: int
    testament: str = Field(description="ot or nt.")


class BookListOut(BaseModel):
    """GET /books."""

    books: list[BookOut]


class VerseOut(BaseModel):
    """One verse."""

    verse: int
    text: str
    osis_id: str
    verse_key: int


class ChapterOut(BaseModel):
    """GET /chapters/{translation}/{book}/{chapter}."""

    reference: str = Field(description="Human reference, e.g. Proverbs 1.")
    translation: str
    book_number: int
    chapter: int
    verses: list[VerseOut]


class SearchHitOut(BaseModel):
    """One verse matching a search."""

    ref: str = Field(description="Display reference, e.g. Ruth 2:3.")
    book_number: int
    chapter: int
    verse: int
    text: str
    osis_id: str
    verse_key: int


class SearchOut(BaseModel):
    """GET /search."""

    query: str
    translation: str
    scope: str = Field(description="Echo of the scope: all, or an OSIS book code.")
    count: int
    results: list[SearchHitOut]


def to_translation_list(translations: list[Translation]) -> TranslationListOut:
    """Map domain translations onto the wire model."""
    return TranslationListOut(
        translations=[
            TranslationOut(
                code=item.code,
                name=item.name,
                language=item.language,
                can_redistribute=item.can_redistribute,
            )
            for item in translations
        ]
    )


def to_book_list(books: list[Book]) -> BookListOut:
    """Map the canon onto the wire model."""
    return BookListOut(
        books=[
            BookOut(
                book_number=book.book_number,
                name=book.name,
                osis=book.osis,
                chapter_count=book.chapter_count,
                testament=book.testament,
            )
            for book in books
        ]
    )


def to_chapter(chapter: Chapter) -> ChapterOut:
    """Map a domain chapter onto the wire model."""
    return ChapterOut(
        reference=chapter.reference,
        translation=chapter.translation,
        book_number=chapter.book.book_number,
        chapter=chapter.chapter,
        verses=[
            VerseOut(
                verse=verse.verse,
                text=verse.text,
                osis_id=verse.osis_id,
                verse_key=verse.verse_key,
            )
            for verse in chapter.verses
        ],
    )


def _to_hit(hit: SearchHit) -> SearchHitOut:
    return SearchHitOut(
        ref=hit.reference,
        book_number=hit.book_number,
        chapter=hit.chapter,
        verse=hit.verse,
        text=hit.text,
        osis_id=hit.osis_id,
        verse_key=hit.verse_key,
    )


def to_search(result: SearchResult) -> SearchOut:
    """Map a search result onto the wire model."""
    return SearchOut(
        query=result.query,
        translation=result.translation,
        scope=result.scope.label,
        count=len(result.hits),
        results=[_to_hit(hit) for hit in result.hits],
    )
