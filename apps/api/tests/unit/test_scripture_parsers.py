"""The scripture parsers, against fixtures rather than the network.

These are the tests that would have caught the prototype's two data defects:
a loader that skipped what it could not resolve, and a loader with no verse
count assertion at all.
"""

from __future__ import annotations

import pytest

from scripts.line_formats import iter_berean_rows, iter_vpl_rows
from scripts.parse_translation import VerseCountMismatch, assert_expected_count
from scripts.sil_book_codes import (
    BOOK_NUMBER_BY_SIL_CODE,
    SIL_CODES_IN_CANONICAL_ORDER,
    book_number_for_code,
)
from scripts.translation_catalogue import CATALOGUE
from scripts.verse_rows import TextCleanup, normalise_text

_VPL = "\n".join(
    [
        "GEN 1:1 In the beginning, God created the heavens and the earth.",
        "MAT 17:21 ",
        "JOH 3:16 [For] God so loved the world.",
        "3JO 1:14 Peace be to thee.",
    ]
)

_BEREAN = "\n".join(
    [
        "The Holy Bible, Berean Standard Bible, BSB is produced in cooperation...",
        "This text of God's Word has been dedicated to the public domain.\t",
        "Verse\tBerean Standard Bible",
        "Genesis 1:1\tIn the beginning God created the heavens and the earth.",
        "1 Samuel 17:45\tYou come against me with sword and spear.",
        "Song of Solomon 2:1\tI am a rose of Sharon.",
        "Matthew 17:21\t",
    ]
)


# ── eBible verse-per-line ────────────────────────────────────────────────────
def test_vpl_resolves_book_codes_that_are_not_osis_codes() -> None:
    """JOH is John and 3JO is 3 John. The domain's alias table knows neither."""
    rows = list(iter_vpl_rows("KJV", _VPL))

    assert [row.osis_id for row in rows] == ["Gen.1.1", "John.3.16", "3John.1.14"]
    assert [row.verse_key for row in rows] == [1_001_001, 43_003_016, 64_001_014]


def test_vpl_drops_the_critical_texts_deliberately_empty_verses() -> None:
    """Matthew 17:21 is printed empty on purpose; it must not become a blank line."""
    assert all(row.verse != 21 for row in iter_vpl_rows("ASV", _VPL))


def test_vpl_strips_supplied_word_brackets_only_when_asked() -> None:
    verbatim = {row.osis_id: row.text for row in iter_vpl_rows("X", _VPL)}
    stripped = {
        row.osis_id: row.text
        for row in iter_vpl_rows("X", _VPL, TextCleanup(strip_supplied_brackets=True))
    }

    assert verbatim["John.3.16"] == "[For] God so loved the world."
    assert stripped["John.3.16"] == "For God so loved the world."


def test_vpl_refuses_an_unknown_book_code() -> None:
    """Skipping is how the prototype produced book_number 0 rows."""
    with pytest.raises(ValueError, match="Unknown eBible book code"):
        list(iter_vpl_rows("X", "ZZZ 1:1 Some text."))


def test_vpl_refuses_a_malformed_reference() -> None:
    with pytest.raises(ValueError, match="Malformed chapter:verse"):
        list(iter_vpl_rows("X", "GEN 1-1 Some text."))


# ── Berean tab-separated ─────────────────────────────────────────────────────
def test_berean_skips_the_preamble_and_parses_multiword_book_names() -> None:
    rows = list(iter_berean_rows("BSB", _BEREAN))

    assert [row.osis_id for row in rows] == ["Gen.1.1", "1Sam.17.45", "Song.2.1"]
    assert rows[0].text.startswith("In the beginning")


def test_berean_refuses_a_payload_whose_header_moved() -> None:
    """Without the header anchor the attribution paragraph becomes scripture."""
    with pytest.raises(ValueError, match="header row"):
        list(iter_berean_rows("BSB", "Genesis 1:1\tIn the beginning"))


def test_berean_refuses_an_unresolvable_book_name() -> None:
    payload = "Verse\tBerean Standard Bible\nHezekiah 1:1\tText."
    with pytest.raises(ValueError, match="Unresolved book name"):
        list(iter_berean_rows("BSB", payload))


# ── Normalisation ────────────────────────────────────────────────────────────
def test_paragraph_marks_are_removed_without_disturbing_the_words() -> None:
    cleanup = TextCleanup(strip_paragraph_marks=True)

    assert normalise_text("¶ For God so loved", cleanup) == "For God so loved"


def test_normalisation_is_a_no_op_on_already_clean_text() -> None:
    text = "For God so loved the world."

    assert normalise_text(text) == text


# ── Book code table ──────────────────────────────────────────────────────────
def test_sil_codes_cover_the_canon_exactly_once() -> None:
    assert len(set(SIL_CODES_IN_CANONICAL_ORDER)) == 66
    assert len(BOOK_NUMBER_BY_SIL_CODE) == 66


@pytest.mark.parametrize(
    ("code", "expected"),
    [("GEN", 1), ("JDG", 7), ("PSA", 19), ("SOL", 22), ("JOH", 43), ("JUD", 65)],
)
def test_sil_codes_that_differ_from_osis_resolve_correctly(code: str, expected: int) -> None:
    """JDG is Judges and JUD is Jude. Confusing them still yields 66 books."""
    assert book_number_for_code(code) == expected


# ── The catalogue itself ─────────────────────────────────────────────────────
def test_no_licensed_translation_is_catalogued() -> None:
    """ESV is in the mockups, is licensed, and must never be loadable."""
    assert "ESV" not in CATALOGUE
    assert all(not source.licence.share_alike for source in CATALOGUE.values())
    assert all(source.licence.identifier == "public-domain" for source in CATALOGUE.values())


def test_every_catalogue_entry_has_its_own_provenance_key() -> None:
    keys = [source.source_key for source in CATALOGUE.values()]

    assert len(set(keys)) == len(keys)
    assert all(source.licence.attribution for source in CATALOGUE.values())


def test_a_short_load_is_refused() -> None:
    source = CATALOGUE["BSB"]

    with pytest.raises(VerseCountMismatch, match="Refusing to load a partial Bible"):
        assert_expected_count(source, [])
