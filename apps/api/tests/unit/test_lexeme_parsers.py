"""The three lexicon parsers, and the source quirks each one absorbs.

Every fixture below is a real record copied from the acquired file, so a change
upstream shows up as a failing test rather than as a wrong badge.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.lexicon.lexeme_builder import build_lexicon_rows
from scripts.lexicon.lexeme_parsers import (
    Lexeme,
    normalise_hebrew_strongs,
    parse_dodson_definitions,
    parse_hebrew_strongs,
    parse_tbesg,
    strip_markup,
)
from scripts.lexicon.tagnt_parser import TagntWord, parse_tagnt_lines
from scripts.lexicon.unicode_text import to_nfc

_TBESG_ROW = (
    "G4576\tG4576 =\tG4576\tσέβομαι\tsebomai\tG:V\tbe devout\t"
    " <b>σέβομαι</b>, <BR /> <b>to worship</b>: <ref='Act.16.14'>Act.16:14</ref>. (AS)"
)
_TBESG_DISAMBIGUATED = (
    "G1135\tG1135G = a woman\tG1135G\tγυνή\tgunē\tG:N-F\twoman\t <b>γυνή</b>, wife."
)

_HEBREW_XML = """<?xml version="1.0" encoding="utf-8"?>
<lexicon xmlns="http://openscriptures.github.com/morphhb/namespace">
  <entry id="H1">
    <w pos="n-m" pron="awb" xlit="'ab" xml:lang="heb">אָב</w>
    <meaning><def>father</def>, in a literal application</meaning>
    <usage>chief, father.</usage>
  </entry>
  <entry id="H2">
    <w pos="n-m" pron="ab" xlit="'ab" xml:lang="arc">אַב</w>
    <usage>father.</usage>
  </entry>
</lexicon>
"""


def test_tbesg_is_keyed_on_the_disambiguated_number_tagnt_actually_uses() -> None:
    """TAGNT tags words `G1135G`. Keying on column 0 would never join."""
    (lexeme,) = parse_tbesg([_TBESG_DISAMBIGUATED])
    assert lexeme.strongs == "G1135G"
    assert lexeme.simple_strongs == "G1135"
    assert lexeme.lemma == "γυνή"
    assert lexeme.translit == "gunē"
    assert lexeme.short_gloss == "woman"


def test_tbesg_definitions_arrive_as_html_and_leave_as_text() -> None:
    (lexeme,) = parse_tbesg([_TBESG_ROW])
    assert lexeme.definition is not None
    assert "<" not in lexeme.definition
    assert "to worship" in lexeme.definition


def test_markup_stripping_collapses_the_whitespace_it_leaves_behind() -> None:
    assert strip_markup("<b>a</b><BR />  <i>b</i>") == "a b"


def test_dodson_is_tab_separated_and_fully_quoted_despite_its_csv_name(
    tmp_path: Path,
) -> None:
    path = tmp_path / "dodson.csv"
    path.write_text(
        '"Strong\'s"\t"GK"\t"Greek Word"\t"brief"\t"longer"\n'
        '"4576"\t"4933"\t"se/bomai"\t"I reverence"\t"I reverence, worship, adore."\n',
        encoding="utf-8",
    )
    assert parse_dodson_definitions(path) == {"G4576": "I reverence, worship, adore."}


def test_hebrew_entries_distinguish_aramaic_from_hebrew(tmp_path: Path) -> None:
    """653 of the 8,674 entries are Aramaic. Calling them Hebrew would set the
    wrong script and the wrong voice on the sheet."""
    path = tmp_path / "HebrewStrong.xml"
    path.write_text(_HEBREW_XML, encoding="utf-8")
    hebrew, aramaic = list(parse_hebrew_strongs(path))
    assert (hebrew.strongs, hebrew.lang) == ("H0001", "hebrew")
    assert (aramaic.strongs, aramaic.lang) == ("H0002", "aramaic")
    assert hebrew.short_gloss == "father, in a literal application"
    assert aramaic.short_gloss is None


def test_hebrew_strongs_numbers_are_zero_padded_to_four_digits() -> None:
    assert normalise_hebrew_strongs("H1") == "H0001"
    assert normalise_hebrew_strongs("H8674") == "H8674"


def _lexeme(strongs: str, simple: str, definition: str | None) -> Lexeme:
    return Lexeme(strongs, simple, "greek", "σέβομαι", "sebomai", "V", "be devout",
                  definition)  # fmt: skip


def _word(strongs: str) -> TagntWord:
    return TagntWord(
        44_016_014, 1, "ὁρᾷ", "hora", "do see", strongs, "G3708", "V-PAM-2S",
        "ὁράω", "to see", "NKO", "NA28",
    )  # fmt: skip


_SOURCE_IDS = {
    "stepbible_tbesg": 1,
    "dodson_greek_lexicon": 2,
    "oshb_hebrew_lexicon": 3,
    "stepbible_tagnt": 4,
    "atlas_gloss_alignment": 5,
}


def test_a_definition_always_names_the_source_that_supplied_it() -> None:
    """AI-05 at the row level: Dodson's text must be credited to Dodson."""
    rows, _ = build_lexicon_rows(
        [_lexeme("G4576", "G4576", "Abbott-Smith text")],
        {"G4576": "I reverence, worship, adore."},
        [],
        _SOURCE_IDS,
    )
    assert rows[0].definition == "I reverence, worship, adore."
    assert rows[0].definition_source_id == _SOURCE_IDS["dodson_greek_lexicon"]
    assert rows[0].source_id == _SOURCE_IDS["stepbible_tbesg"]


def test_without_dodson_the_definition_falls_back_to_the_lexicon_that_has_one() -> None:
    rows, _ = build_lexicon_rows(
        [_lexeme("G4576", "G4576", "Abbott-Smith text")], {}, [], _SOURCE_IDS
    )
    assert rows[0].definition == "Abbott-Smith text"
    assert rows[0].definition_source_id == _SOURCE_IDS["stepbible_tbesg"]


def test_a_strongs_number_no_lexicon_covers_is_minted_from_tagnt_itself() -> None:
    """Five of TAGNT's numbers are absent from TBESG. Dropping 317 words, or
    weakening the foreign key, are both worse than minting the lemma TAGNT
    already carries in its own dictionary column."""
    rows, minted = build_lexicon_rows([], {}, [_word("G3708")], _SOURCE_IDS)
    assert minted == ["G3708"]
    assert rows[0].lemma == "ὁράω"
    assert rows[0].short_gloss == "to see"
    assert rows[0].source_id == _SOURCE_IDS["stepbible_tagnt"]
    assert rows[0].definition is None and rows[0].definition_source_id is None


def test_a_covered_number_is_not_minted_twice() -> None:
    rows, minted = build_lexicon_rows(
        [_lexeme("G3708", "G3708", None)], {}, [_word("G3708")], _SOURCE_IDS
    )
    assert minted == []
    assert len(rows) == 1


def test_unknown_xml_language_is_refused_rather_than_defaulted(tmp_path: Path) -> None:
    path = tmp_path / "HebrewStrong.xml"
    path.write_text(_HEBREW_XML.replace('xml:lang="arc"', 'xml:lang="grc"'), encoding="utf-8")
    with pytest.raises(ValueError, match="unknown xml:lang"):
        list(parse_hebrew_strongs(path))


def test_greek_is_normalised_so_two_spellings_of_one_word_compare_equal() -> None:
    """TBESG writes σέβομαι with U+1F73 (oxia); everyone else writes U+03AD
    (tonos). They render identically and compare unequal, so both are stored in
    NFC -- otherwise search finds nothing and a flashcard never matches itself."""
    oxia = "σέβομαι"
    tonos = "σέβομαι"
    assert oxia != tonos
    assert to_nfc(oxia) == tonos
    (lexeme,) = parse_tbesg([_TBESG_ROW.replace("σέ", "σέ")])
    assert lexeme.lemma == tonos


def test_the_greek_surface_form_is_normalised_too() -> None:
    row = (
        "Act.16.14#09=NKO	σεβομένη"
        " (sebomenē)	worshiping	G4576=V-PNP-NSF	σέβο"
        "μαι=be devout	NA28					#09	G4576	"
    )
    (word,) = parse_tagnt_lines([row])
    assert word.surface == "σεβομένη"
    assert word.lemma == "σέβομαι"
