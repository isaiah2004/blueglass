"""Render a verse key (or span) the way a reader writes it.

Purpose
    "Acts 16:14", "Rom 8:1-4", "Rom 16:27 - 1 Cor 1:1" -- every module that
    cites a verse (badges' cross-reference records, the Studio Assistant's
    citation chips) needs the same three shapes, so this is written once,
    here, in the scripture domain that owns the book table it depends on.

Dependencies
    The book table and verse-key arithmetic, both in this package. Pure.

Usage
    display_reference(43003016, 43003016)   # "John 3:16"
    display_reference(45008001, 45008004)   # "Rom 8:1-4"
"""

from __future__ import annotations

from .books import BY_NUMBER
from .verse_key import split_verse_key


def display_reference(start_key: int, end_key: int) -> str:
    """Render a verse span the way a reader writes it.

    Three shapes, because callers publish all three: a single verse
    ("John 3:16"), a span inside one chapter ("Rom 8:1-4"), and a span
    crossing a chapter or a book ("Rom 8:1 - 9:5", "Rom 16:27 - 1 Cor 1:1").
    """
    start_book, start_chapter, start_verse = split_verse_key(start_key)
    end_book, end_chapter, end_verse = split_verse_key(end_key)
    head = f"{_book_name(start_book)} {start_chapter}:{start_verse}"
    if start_key == end_key:
        return head
    if start_book == end_book and start_chapter == end_chapter:
        return f"{head}-{end_verse}"
    if start_book == end_book:
        return f"{head} - {end_chapter}:{end_verse}"
    return f"{head} - {_book_name(end_book)} {end_chapter}:{end_verse}"


def _book_name(book_number: int) -> str:
    """A book's display name, or its number when it is outside the canon."""
    book = BY_NUMBER.get(book_number)
    return book.name if book is not None else str(book_number)
