"""The Murai parsing rules, exercised on the shapes the real workbooks contain.

Every input below was copied from the retrieved spreadsheets, so a change in
the grammar these tests describe is a change in what the loader can read.
"""

from __future__ import annotations

import pytest

from scripts.murai_books import SheetError, require_sheet
from scripts.murai_copyright import looks_like_quoted_scripture, safe_gloss
from scripts.murai_patterns import CHIASM, OTHER, PARALLEL, SEQUENCE, classify, pair_label
from scripts.murai_records import passage_id_for
from scripts.murai_spans import SpanError, parse_span, parse_span_with

ACTS = 44
GENESIS = 1
FIRST_SAMUEL = 9
SECOND_SAMUEL = 10


class TestSpanGrammar:
    """The eight span shapes measured across all four workbooks."""

    @pytest.mark.parametrize(
        ("text", "start", "end"),
        [
            ("1:1-11", 44_001_001, 44_001_011),
            ("2:14", 44_002_014, 44_002_014),
            ("3:1-26 4:1-4", 44_003_001, 44_004_004),
            ("Ac1:1-11", 44_001_001, 44_001_011),
            ("Act3:1-4:4", 44_003_001, 44_004_004),
            ("Acts 1:1-11", 44_001_001, 44_001_011),
        ],
    )
    def test_recognises_every_form_in_the_corpus(
        self, text: str, start: int, end: int
    ) -> None:
        span = parse_span(text, book_number=ACTS)

        assert (span.start_key, span.end_key) == (start, end)

    def test_part_verses_round_to_the_whole_verse(self) -> None:
        """2:1-4a is verses 1 to 4; the key scheme has no sub-verse position."""
        span = parse_span("2:1-4a", book_number=GENESIS)

        assert (span.start_key, span.end_key) == (1_002_001, 1_002_004)

    def test_a_range_may_cross_a_chapter_boundary(self) -> None:
        span = parse_span("1:1-2:6a", book_number=35)

        assert (span.start_key, span.end_key) == (35_001_001, 35_002_006)

    def test_a_multi_range_span_keeps_every_range(self) -> None:
        span = parse_span("3:1-26 4:1-4", book_number=ACTS)

        assert len(span.ranges) == 2
        assert span.ranges[0].end_key == 44_003_026

    def test_a_cell_with_no_range_is_an_error_not_a_shrug(self) -> None:
        """A silently dropped span is a pericope missing from the canon."""
        with pytest.raises(SpanError):
            parse_span("Genealogy of Adam", book_number=GENESIS)


class TestCombinedSheets:
    """Four sheets hold two books each, and the prefix is the only signal."""

    def test_a_single_book_sheet_ignores_the_prefix(self) -> None:
        """Acts writes both "Ac" and "Act"; the sheet name is authoritative."""
        sheet = require_sheet("Acts")

        assert sheet.resolve("Ac") == ACTS
        assert sheet.resolve("") == ACTS

    def test_a_combined_sheet_reads_the_prefix(self) -> None:
        sheet = require_sheet("Samuel")

        assert sheet.resolve("1S") == FIRST_SAMUEL
        assert sheet.resolve("2Sam") == SECOND_SAMUEL

    def test_a_combined_sheet_refuses_an_unprefixed_span(self) -> None:
        with pytest.raises(SheetError):
            require_sheet("Kings").resolve("")

    def test_an_unknown_sheet_stops_the_load(self) -> None:
        with pytest.raises(SheetError):
            require_sheet("Maccabees")

    @pytest.mark.parametrize(
        ("sheet_name", "expected"), [("Lamentation", 25), ("SongofSolomon", 22)]
    )
    def test_the_two_sheet_names_the_api_lookup_misses(
        self, sheet_name: str, expected: int
    ) -> None:
        assert require_sheet(sheet_name).default_book == expected

    def test_spans_in_a_combined_sheet_land_in_different_books(self) -> None:
        sheet = require_sheet("Samuel")

        first = parse_span_with("1S4:1a", sheet.resolve)
        second = parse_span_with("2S3:6-21c", sheet.resolve)

        assert first.book_number == FIRST_SAMUEL
        assert second.book_number == SECOND_SAMUEL


class TestCopyrightGuard:
    """The NAB/NRSV/NJB quotations must not survive the parse."""

    @pytest.mark.parametrize(
        "text",
        [
            "1:2 until the day he was taken up (1:2)",
            '"and a very loud trumpet blast" (19:16)',
            "2:11 yet we hear them speaking in our own tongues (2:11)",
        ],
    )
    def test_quoted_scripture_is_dropped(self, text: str) -> None:
        assert looks_like_quoted_scripture(text)
        assert safe_gloss(text) is None

    @pytest.mark.parametrize(
        "text",
        [
            "Question of disciples",
            "List of apostles",
            "A: Being taken up. B: Appearance, hiding.",
            "On that day",
        ],
    )
    def test_murais_own_glosses_survive(self, text: str) -> None:
        assert not looks_like_quoted_scripture(text)
        assert safe_gloss(text) == text

    def test_a_blank_cell_becomes_none_not_an_empty_string(self) -> None:
        assert safe_gloss("   ") is None
        assert safe_gloss(None) is None


class TestPatternClassification:
    """The shape the badge draws, derived from the labels the author wrote."""

    def test_a_chiasm_with_a_pivot(self) -> None:
        shape = classify(["A", "B", "C", "D", "C'", "B'", "A'"])

        assert shape.pattern == CHIASM
        assert shape.centre == "D"

    def test_a_chiasm_with_no_pivot(self) -> None:
        shape = classify(["A", "B", "B'", "A'"])

        assert shape.pattern == CHIASM
        assert shape.centre is None

    def test_a_parallel_is_not_a_chiasm(self) -> None:
        """Acts 2:1-13 is A B A' B' -- repetition, not inversion."""
        shape = classify(["A", "B", "A'", "B'"])

        assert shape.pattern == PARALLEL

    def test_an_unpaired_list_is_a_sequence(self) -> None:
        assert classify(["A1", "A2", "A3"]).pattern == SEQUENCE

    def test_an_arrangement_that_is_neither_says_so(self) -> None:
        assert classify(["A", "B", "C", "A'", "C'"]).pattern == OTHER

    def test_prime_marks_pair_nodes(self) -> None:
        assert pair_label("A'") == pair_label("A") == "A"


def test_passage_ids_are_derived_from_the_range_alone() -> None:
    """The two workbooks write the same range differently; only the keys join."""
    assert passage_id_for(44_001_001, 44_001_011) == "murai:044001001-044001011"
