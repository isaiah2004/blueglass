"""Verse-key arithmetic. John 3:16 is 43003016, everywhere, forever."""

from __future__ import annotations

import pytest

from app.modules.scripture.domain import (
    BOOKS,
    osis_id_for,
    osis_id_from_key,
    split_verse_key,
    verse_key,
)
from app.shared.errors import ValidationError


def test_the_canonical_example() -> None:
    assert verse_key(43, 3, 16) == 43_003_016
    assert osis_id_for(43, 3, 16) == "John.3.16"


def test_compose_and_split_round_trip_across_the_canon() -> None:
    for book in BOOKS:
        key = verse_key(book.book_number, book.chapter_count, 1)
        assert split_verse_key(key) == (book.book_number, book.chapter_count, 1)


def test_osis_from_key_matches_osis_from_parts() -> None:
    assert osis_id_from_key(20_001_001) == osis_id_for(20, 1, 1) == "Prov.1.1"


@pytest.mark.parametrize(
    ("book", "chapter", "verse"),
    [(0, 1, 1), (67, 1, 1), (43, 0, 16), (43, 3, 0), (43, 1000, 1), (43, 3, 1000)],
)
def test_out_of_range_components_are_rejected(book: int, chapter: int, verse: int) -> None:
    """Silently producing a key that decodes to a different verse is the failure
    mode this guards: 43 * 1e6 + 1000 * 1000 + 1 is a Romans verse key."""
    with pytest.raises(ValidationError):
        verse_key(book, chapter, verse)
