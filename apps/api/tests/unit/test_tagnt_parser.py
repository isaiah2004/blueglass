"""The TAGNT parser, and the two traps it exists to absorb.

The versification cases are real references taken from the acquired files, not
invented ones: `Mat.17.15[17.14]` and `Rev.12.18[13.1]` are the shapes that
would have put words one verse away from the reader who tapped them.
"""

from __future__ import annotations

import pytest

from scripts.lexicon.step_book_codes import book_number_for_step_code
from scripts.lexicon.tagnt_parser import (
    parse_tagnt_lines,
    renumber_merged_verses,
)

_COLUMNS = "\tΚαί (Kai)\tAnd\tG2532=CONJ\tκαί=and\tNA28+TR\t\t\tY\tand\t#01\tG2532\t\t\t\t"


def _row(reference: str, tail: str = _COLUMNS) -> str:
    return reference + tail


def test_parses_a_word_into_its_parts() -> None:
    (word,) = parse_tagnt_lines([_row("Act.16.14#01=NKO")])
    assert word.verse_key == 44_016_014
    assert word.word_index == 1
    assert word.surface == "Καί"
    assert word.translit == "Kai"
    assert word.gloss == "And"
    assert word.strongs == "G2532"
    assert word.simple_strongs == "G2532"
    assert word.morph == "CONJ"
    assert word.lemma == "καί"
    assert word.lemma_gloss == "and"
    assert word.variant_code == "NKO"
    assert word.editions == "NA28+TR"


def test_square_brackets_move_the_word_to_its_kjv_verse() -> None:
    """TAGNT is NRSV-versified; `verses` is KJV. The bracket is the KJV ref."""
    (word,) = parse_tagnt_lines([_row("Mat.17.15[17.14]#01=NKO")])
    assert word.verse_key == 40_017_014


def test_round_and_curly_traditions_are_ignored_not_applied() -> None:
    """`(...)` is NA and `{...}` is other traditions. Neither is our versification."""
    (na,) = parse_tagnt_lines([_row("Act.13.39(13.38)#01=NKO")])
    (other,) = parse_tagnt_lines([_row("Rom.16.25{14.24}#01=NKO")])
    assert na.verse_key == 44_013_039
    assert other.verse_key == 45_016_025


def test_prose_legend_and_preview_lines_are_skipped() -> None:
    lines = [
        "TAGNT Mat-Jhn - Translators Amalgamated Greek NT\t\t\t",
        "# Act.16.14\tΚαί \tτις \t",
        "#_Translation\tAnd\ta certain\t",
        "Word & Type\tGreek\tEnglish translation\t",
        "",
        _row("Act.16.14#01=NKO"),
    ]
    assert [word.word_index for word in parse_tagnt_lines(lines)] == [1]


def test_a_short_data_row_is_fatal_rather_than_guessed() -> None:
    with pytest.raises(ValueError, match="columns"):
        list(parse_tagnt_lines(["Act.16.14#01=NKO\tΚαί (Kai)\tAnd"]))


def test_instance_suffix_is_stripped_from_the_simple_strongs_number() -> None:
    """`G3588_A` is the first article in the verse. The badge prints `G3588`."""
    tail = _COLUMNS.replace("\tG2532\t\t\t\t", "\tG3588_A\t\t\t\t")
    (word,) = parse_tagnt_lines([_row("Act.16.14#10=NKO", tail)])
    assert word.simple_strongs == "G3588"


def test_merged_verses_are_renumbered_in_canonical_order() -> None:
    """KJV Matthew 17:14 holds NRSV 17:14 AND the head of 17:15."""
    words = list(
        parse_tagnt_lines(
            [
                _row("Mat.17.14#01=NKO"),
                _row("Mat.17.14#02=NKO"),
                _row("Mat.17.15[17.14]#01=NKO"),
            ]
        )
    )
    renumbered, merged = renumber_merged_verses(words)
    assert [word.word_index for word in renumbered] == [1, 2, 3]
    assert {word.verse_key for word in renumbered} == {40_017_014}
    assert merged == 1


def test_renumbering_leaves_an_ordinary_verse_untouched() -> None:
    words = list(parse_tagnt_lines([_row("Act.16.14#01=NKO"), _row("Act.16.14#02=NKO")]))
    renumbered, merged = renumber_merged_verses(words)
    assert [word.word_index for word in renumbered] == [1, 2]
    assert merged == 0


def test_a_kjv_verse_may_start_partway_through_an_nrsv_verse() -> None:
    """The other half of the split: KJV 17:15 begins at NRSV 17:15 word #03."""
    words = list(parse_tagnt_lines([_row("Mat.17.15#03=NKO"), _row("Mat.17.15#04=NKO")]))
    renumbered, merged = renumber_merged_verses(words)
    assert [word.word_index for word in renumbered] == [1, 2]
    assert merged == 1


@pytest.mark.parametrize(
    ("code", "expected"),
    [("Mat", 40), ("Mrk", 41), ("Jhn", 43), ("Act", 44), ("Php", 50), ("Jud", 65)],
)
def test_step_book_codes_that_differ_from_osis_and_sil(code: str, expected: int) -> None:
    assert book_number_for_step_code(code) == expected


def test_an_unknown_book_code_is_refused_not_defaulted() -> None:
    with pytest.raises(ValueError, match="Unknown STEPBible book code"):
        book_number_for_step_code("Gen")
