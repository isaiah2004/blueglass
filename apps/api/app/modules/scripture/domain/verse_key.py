"""Verse-key arithmetic and OSIS ids.

Purpose
    verse_key = book_number * 1_000_000 + chapter * 1_000 + verse. John 3:16 is
    43_003_016. It is the universal verse identity across the whole product --
    highlights key off it, search returns it, cross-references use it -- and the
    port map instructs us to adopt it verbatim.

Key responsibilities
    - Compose and decompose a verse key, rejecting out-of-range components
      rather than silently producing a key that decodes to something else.
    - Render an OSIS id for a verse.

Dependencies
    The books table, for OSIS codes. Pure functions.

Usage
    key = verse_key(43, 3, 16)      # 43003016
    osis_id_for(43, 3, 16)          # "John.3.16"
"""

from __future__ import annotations

from ....shared.errors import ValidationError
from .books import BY_NUMBER

_BOOK_FACTOR = 1_000_000
_CHAPTER_FACTOR = 1_000
_MAX_COMPONENT = 999


def verse_key(book_number: int, chapter: int, verse: int) -> int:
    """Compose a verse key.

    Chapter and verse are bounded at 999 because the encoding cannot represent
    more; the longest chapter in the canon is Psalm 119 at 176 verses, so the
    bound is a correctness guard, not a limit anyone reaches.
    """
    if book_number not in BY_NUMBER:
        raise ValidationError(
            f"book_number must be 1-66, got {book_number}",
            details={"book_number": book_number},
        )
    for name, value in (("chapter", chapter), ("verse", verse)):
        if not 1 <= value <= _MAX_COMPONENT:
            raise ValidationError(
                f"{name} must be 1-{_MAX_COMPONENT}, got {value}",
                details={name: value},
            )
    return book_number * _BOOK_FACTOR + chapter * _CHAPTER_FACTOR + verse


def split_verse_key(key: int) -> tuple[int, int, int]:
    """Decompose a verse key into (book_number, chapter, verse)."""
    return (
        key // _BOOK_FACTOR,
        (key // _CHAPTER_FACTOR) % _CHAPTER_FACTOR,
        key % _CHAPTER_FACTOR,
    )


def osis_id_for(book_number: int, chapter: int, verse: int) -> str:
    """Render the OSIS id for a verse, e.g. "John.3.16"."""
    book = BY_NUMBER.get(book_number)
    if book is None:
        raise ValidationError(
            f"book_number must be 1-66, got {book_number}",
            details={"book_number": book_number},
        )
    return f"{book.osis}.{chapter}.{verse}"


def osis_id_from_key(key: int) -> str:
    """Render the OSIS id for a verse key."""
    return osis_id_for(*split_verse_key(key))
