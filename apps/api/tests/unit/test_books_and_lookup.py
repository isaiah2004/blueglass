"""The 66-book table and its tolerant lookup.

Port-map risk 10: the Flutter prototype mapped only three books, so a note added
in John stored book_number 0. These tests make an incomplete table impossible.
"""

from __future__ import annotations

import pytest

from app.modules.scripture.domain import (
    BOOKS,
    CANONICAL_BOOK_COUNT,
    CANONICAL_CHAPTER_COUNT,
    book_number_from_any,
    normalise_token,
    require_book,
)
from app.shared.errors import NotFoundError


def test_the_canon_is_complete_and_in_order() -> None:
    assert len(BOOKS) == CANONICAL_BOOK_COUNT
    assert [book.book_number for book in BOOKS] == list(range(1, 67))


def test_chapter_counts_sum_to_the_canon_total() -> None:
    """A typo in one row moves this number, which is why it is asserted."""
    assert sum(book.chapter_count for book in BOOKS) == CANONICAL_CHAPTER_COUNT


def test_names_and_osis_codes_are_unique() -> None:
    assert len({book.name for book in BOOKS}) == CANONICAL_BOOK_COUNT
    assert len({book.osis for book in BOOKS}) == CANONICAL_BOOK_COUNT


def test_every_book_round_trips_through_its_own_name_and_code() -> None:
    """The exhaustive version of the risk-10 fix."""
    for book in BOOKS:
        assert book_number_from_any(book.name) == book.book_number
        assert book_number_from_any(book.osis) == book.book_number
        assert book_number_from_any(str(book.book_number)) == book.book_number


@pytest.mark.parametrize(
    ("token", "expected"),
    [
        ("prov", 20),
        ("Prov.", 20),
        ("1cor", 46),
        ("1 Cor", 46),
        ("sos", 22),
        ("Song of Songs", 22),
        ("psalm", 19),
        ("Revelation of John", 66),
        ("iii john", 64),
        ("  John  ", 43),
    ],
)
def test_common_spellings_resolve(token: str, expected: int) -> None:
    assert book_number_from_any(token) == expected


@pytest.mark.parametrize("token", ["", "Hezekiah", "0", "67", "-1", "Book of Mormon"])
def test_nonsense_does_not_resolve(token: str) -> None:
    assert book_number_from_any(token) is None


def test_require_book_raises_a_typed_not_found() -> None:
    with pytest.raises(NotFoundError) as raised:
        require_book("Hezekiah")

    assert raised.value.code == "book_not_found"
    assert raised.value.status_code == 404


def test_normalise_token_drops_punctuation_and_case() -> None:
    assert normalise_token("1 Cor.") == "1cor"
    assert normalise_token("Song of Solomon") == "songofsolomon"
