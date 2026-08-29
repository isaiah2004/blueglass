"""The cross-reference parser, on rows transcribed from the acquired file.

Every fixture line below is either copied verbatim from
data/raw/openbible-cross-references/ or is a deliberate corruption of one.
"""

from __future__ import annotations

import io
import zipfile

import pytest

from scripts.crossref_rows import (
    ARCHIVE_MEMBER,
    CrossReferenceFormatError,
    archive_text,
    assert_licence_header,
    parse_cross_references,
)

HEADER = "From Verse\tTo Verse\tVotes\t#www.openbible.info CC-BY 2026-08-24"

#: The first two data rows of the published file, verbatim.
REAL_ROWS = "Gen.1.1\tIsa.37.16\t63\nGen.1.1\tPs.124.8\t71"


def _file(*lines: str) -> str:
    return "\n".join((HEADER, *lines))


def test_the_published_header_is_accepted() -> None:
    """It returns nothing and raises nothing. Both halves matter."""
    assert assert_licence_header(HEADER) is None


def test_a_header_without_the_licence_is_refused() -> None:
    """The licence travels in the bytes. If it stops, we stop (AI-05)."""
    with pytest.raises(CrossReferenceFormatError, match="CC-BY"):
        assert_licence_header("From Verse\tTo Verse\tVotes")


def test_two_real_rows_parse_to_two_rows() -> None:
    rows = sorted(parse_cross_references(_file(REAL_ROWS)), key=lambda r: r.votes)

    assert [(row.from_key, row.to_start_key, row.votes) for row in rows] == [
        (1_001_001, 23_037_016, 63),
        (1_001_001, 19_124_008, 71),
    ]


def test_a_single_verse_target_has_equal_endpoints() -> None:
    (row,) = parse_cross_references(_file("Gen.1.1\tIsa.37.16\t63"))

    assert row.to_start_key == row.to_end_key


def test_a_ranged_target_keeps_both_endpoints() -> None:
    (row,) = parse_cross_references(_file("John.3.16\t1John.4.9-1John.4.10\t120"))

    assert (row.to_start_key, row.to_end_key) == (62_004_009, 62_004_010)


def test_a_negative_vote_is_preserved() -> None:
    """3,506 published rows sit at or below zero. Filtering is a read-time
    decision (DECISIONS #11); a filter applied here could not be undone."""
    (row,) = parse_cross_references(_file("Gen.1.1\tIsa.37.16\t-86"))

    assert row.votes == -86


def test_blank_lines_are_skipped() -> None:
    assert len(parse_cross_references(_file(REAL_ROWS, "", "   "))) == 2


def test_a_duplicate_triple_collapses_to_the_higher_vote() -> None:
    """The COPY that follows has no ON CONFLICT, so a duplicate would abort
    the whole load rather than being dropped."""
    (row,) = parse_cross_references(_file("Gen.1.1\tIsa.37.16\t63", "Gen.1.1\tIsa.37.16\t99"))

    assert row.votes == 99


def test_a_row_with_the_wrong_column_count_names_its_line() -> None:
    with pytest.raises(CrossReferenceFormatError, match="Line 3"):
        parse_cross_references(_file("Gen.1.1\tIsa.37.16\t63", "Gen.1.1\tIsa.37.16"))


def test_a_non_numeric_vote_is_refused() -> None:
    with pytest.raises(CrossReferenceFormatError, match="non-numeric vote"):
        parse_cross_references(_file("Gen.1.1\tIsa.37.16\tmany"))


def test_the_archive_must_hold_exactly_the_expected_member() -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("something_else.txt", "x")

    with pytest.raises(CrossReferenceFormatError, match="Expected exactly"):
        archive_text(buffer.getvalue())


def test_the_expected_member_is_read_back() -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(ARCHIVE_MEMBER, _file(REAL_ROWS))

    assert archive_text(buffer.getvalue()).startswith("From Verse")
