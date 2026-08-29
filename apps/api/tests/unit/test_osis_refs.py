"""OSIS references resolve to the project's verse keys, or fail loudly.

The cross-reference file is 344,799 rows of OSIS strings and 88,150 of them
name a range. A parser that quietly produced a wrong key would put a badge's
whole reference list on the wrong verse and nothing would look broken.
"""

from __future__ import annotations

import pytest

from scripts.osis_refs import OsisReferenceError, parse_osis_range, parse_osis_verse


def test_a_single_verse_resolves_to_its_key() -> None:
    assert parse_osis_verse("Acts.16.12") == 44_016_012


def test_the_numbered_books_resolve() -> None:
    """1John, 2Kgs and 3John are the codes a naive split gets wrong."""
    assert parse_osis_verse("1John.4.9") == 62_004_009
    assert parse_osis_verse("2Kgs.5.12") == 12_005_012
    assert parse_osis_verse("3John.1.4") == 64_001_004


def test_the_two_awkward_book_codes_resolve() -> None:
    """OpenBible writes Psalms as Ps and Song of Songs as Song."""
    assert parse_osis_verse("Ps.124.8") == 19_124_008
    assert parse_osis_verse("Song.1.1") == 22_001_001


def test_a_single_verse_becomes_a_one_verse_range() -> None:
    assert parse_osis_range("Gen.1.1") == (1_001_001, 1_001_001)


def test_a_range_keeps_both_endpoints() -> None:
    assert parse_osis_range("1John.4.9-1John.4.10") == (62_004_009, 62_004_010)


def test_a_range_may_cross_a_chapter() -> None:
    """637 published ranges do. Expanding them would need a versification map."""
    assert parse_osis_range("Rom.8.39-Rom.9.1") == (45_008_039, 45_009_001)


def test_an_unknown_book_is_refused() -> None:
    with pytest.raises(OsisReferenceError, match="unknown book"):
        parse_osis_verse("Enoch.1.1")


def test_a_malformed_reference_is_refused() -> None:
    with pytest.raises(OsisReferenceError):
        parse_osis_verse("Acts.16")


def test_a_non_numeric_chapter_is_refused() -> None:
    with pytest.raises(OsisReferenceError, match="non-numeric"):
        parse_osis_verse("Acts.xvi.12")


def test_a_backwards_range_is_refused() -> None:
    with pytest.raises(OsisReferenceError, match="ends before"):
        parse_osis_range("Acts.16.12-Acts.16.11")
