"""The reader never sees OpenBible's homonym bookkeeping, and never loses it.

Two failures are in tension here and both are pillar-3 failures:

  * printing "Ramah 2" beside scripture asserts a name no manuscript uses;
  * stripping the ordinal and stopping there merges nine different towns into
    one label, so a sheet would confidently show the wrong Ramah.

Every case below pins one side or the other. The strings are transcribed from
data/raw/openbible-geocoding/ancient.jsonl.
"""

from __future__ import annotations

import pytest

from scripts.place_disambiguation import (
    homonym_counts,
    plain_text_note,
    split_display_name,
)


@pytest.mark.parametrize(
    ("friendly_id", "expected"),
    [
        ("Ramah 2", ("Ramah", 2)),
        ("Ramah 9", ("Ramah", 9)),
        ("Achzib 1", ("Achzib", 1)),
        ("Gath-rimmon 2", ("Gath-rimmon", 2)),
        ("Bethsaida 2", ("Bethsaida", 2)),
    ],
)
def test_the_trailing_ordinal_leaves_the_name(
    friendly_id: str, expected: tuple[str, int]
) -> None:
    """315 of the 1,342 published ids carry one of these."""
    assert split_display_name(friendly_id) == expected


@pytest.mark.parametrize(
    "friendly_id",
    ["Philippi", "Mount Zion", "Beth-lebaoth", "The Lord Will Provide", "Sardis"],
)
def test_a_name_without_an_ordinal_is_untouched(friendly_id: str) -> None:
    assert split_display_name(friendly_id) == (friendly_id, None)


def test_the_ordinal_is_kept_not_discarded() -> None:
    """The whole point of the split. Rejoining name and index reproduces the
    published id exactly, so nothing about the source is lost."""
    name, index = split_display_name("Ramah 2")

    assert f"{name} {index}" == "Ramah 2"


def test_a_real_name_that_ends_in_a_number_survives() -> None:
    """modern.jsonl really does publish "Feldstein et al Site 43". This rule is
    applied ONLY to ancient friendly_ids for exactly this reason -- but even
    there the function must not invent a name nobody uses."""
    assert split_display_name("Feldstein et al Site 43") == (
        "Feldstein et al Site",
        43,
    )


def test_a_name_that_is_only_digits_is_left_alone() -> None:
    """Otherwise the label would fold to the empty string and the row would
    carry no name at all."""
    assert split_display_name("7") == ("7", None)


def test_a_shared_name_is_counted_so_a_sheet_can_admit_it() -> None:
    """homonym_count > 1 is the honest signal: the name alone does not identify
    the place, so the sheet must say so instead of picking one (DECISIONS #10)."""
    counts = homonym_counts(["Ramah", "Ramah", "Philippi"])

    assert counts["Ramah"] == 2
    assert counts["Philippi"] == 1


def test_an_ordinal_with_no_sibling_still_counts_as_unique() -> None:
    """Three ordinals in the file are spurious -- "Carmel 1", "Joktheel 1" and
    "Kadesh 2" have no siblings. Stripping them loses nothing."""
    assert homonym_counts(["Carmel", "Mount Carmel"])["Carmel"] == 1


def test_the_note_arrives_as_text_not_as_markup() -> None:
    """OpenBible publishes `comment` as HTML. 141 of the 275 notes contain
    tags; rendering one raw is the same class of bug as the ordinal."""
    note = 'in <ancient id="a890adf">Syria</ancient>; east of the river'

    assert plain_text_note(note) == "in Syria; east of the river"


def test_entities_are_resolved_in_the_note() -> None:
    assert plain_text_note("Adriatic &amp; Ionian") == "Adriatic & Ionian"


@pytest.mark.parametrize("comment", [None, "", "   ", "<span></span>", 7])
def test_a_missing_note_stays_missing(comment: object) -> None:
    """203 of the 312 shared-name places have no note. None is the answer;
    there is no fallback that would invent one."""
    assert plain_text_note(comment) is None
