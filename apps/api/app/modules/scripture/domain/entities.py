"""Scripture entities and value objects. Framework-free by construction.

Purpose
    Give the application layer types to speak in that owe nothing to Postgres,
    Pydantic or FastAPI. Rule 5.1.2: the domain has zero infrastructure imports.

Key responsibilities
    - Verse, Chapter, Translation, SearchHit.
    - SearchScope, the parsed form of the search endpoint's scope parameter.

Dependencies
    Standard library plus the sibling books and verse-key modules.

Usage
    chapter = Chapter(translation="BSB", book=book, chapter=1, verses=[...])
"""

from __future__ import annotations

from dataclasses import dataclass

from .books import Book


@dataclass(frozen=True, slots=True)
class Translation:
    """A loaded translation. Only translations with verses are ever returned."""

    code: str
    name: str
    language: str
    can_redistribute: bool


@dataclass(frozen=True, slots=True)
class Verse:
    """One verse of one translation."""

    verse: int
    text: str
    osis_id: str
    verse_key: int


@dataclass(frozen=True, slots=True)
class Chapter:
    """A whole chapter, in verse order."""

    translation: str
    book: Book
    chapter: int
    verses: tuple[Verse, ...]

    @property
    def reference(self) -> str:
        """Human reference, e.g. "Proverbs 1"."""
        return f"{self.book.name} {self.chapter}"


@dataclass(frozen=True, slots=True)
class SearchHit:
    """One verse matching a search, with its display reference."""

    book_number: int
    chapter: int
    verse: int
    text: str
    osis_id: str
    verse_key: int
    reference: str


@dataclass(frozen=True, slots=True)
class SearchScope:
    """Where a search may look.

    The reader UI offers two pills, All and This book, so the wire form is
    either the literal "all" or a book token. Parsing lives in the application
    layer; this type is the parsed result.
    """

    book: Book | None

    @property
    def is_whole_bible(self) -> bool:
        """True when the search is unscoped."""
        return self.book is None

    @property
    def label(self) -> str:
        """The scope echoed back to the client."""
        return "all" if self.book is None else self.book.osis
