"""`bare_surface`: the word under "AS WRITTEN HERE" is the word, and only it.

Found by reading the shipped Root sheet, not by a failing test. Acts 16:11
printed the Greek with the verse's comma still attached and 16:12 with its full
stop, so a label promising "the word as it appears" showed a word plus a clause
boundary -- and the reader was being invited to compare that string with the
lemma printed beside it.

The elision case is the reason the rule is a named list of marks rather than
"strip every Unicode punctuation character": Greek writes an elided preposition
with a right single quote, and that mark spells the word.

Every non-ASCII character below is built by codepoint, the same way
`test_badge_anchors.py` builds its curly apostrophe: the file stays plain ASCII
while the assertions still exercise the characters TAGNT actually ships.
"""

from __future__ import annotations

from app.modules.badges.domain import bare_surface

#: Sigma-alpha-mu-omicron: the head of the Acts 16:11 token, enough to test with.
SAMOTHRACE = "".join(chr(code) for code in (0x3A3, 0x3B1, 0x3BC, 0x3BF))
#: `di'` -- "through", elided before a vowel. The mark is part of the spelling.
ELIDED = "".join(chr(code) for code in (0x3B4, 0x3B9, 0x2019))
#: Ano teleia (Greek semicolon) and erotimatiko (Greek question mark).
ANO_TELEIA = chr(0x387)
EROTIMATIKO = chr(0x37E)
LEFT_QUOTE = chr(0x201C)
RIGHT_QUOTE = chr(0x201D)


class TestBareSurface:
    """One rule: clause marks at the ends go, everything else stays."""

    def test_strips_the_trailing_comma_acts_16_11_actually_shipped(self) -> None:
        assert bare_surface(f"{SAMOTHRACE},") == SAMOTHRACE

    def test_strips_the_trailing_full_stop_acts_16_12_actually_shipped(self) -> None:
        assert bare_surface(f"{SAMOTHRACE}.") == SAMOTHRACE

    def test_strips_the_two_greek_marks_that_are_not_latin_punctuation(self) -> None:
        assert bare_surface(f"{SAMOTHRACE}{ANO_TELEIA}") == SAMOTHRACE
        assert bare_surface(f"{SAMOTHRACE}{EROTIMATIKO}") == SAMOTHRACE

    def test_strips_a_leading_quotation_mark_as_well_as_a_trailing_one(self) -> None:
        assert bare_surface(f"{LEFT_QUOTE}{SAMOTHRACE}{RIGHT_QUOTE}") == SAMOTHRACE

    def test_keeps_an_elision_mark_because_it_spells_the_word(self) -> None:
        assert bare_surface(ELIDED) == ELIDED

    def test_leaves_a_clean_token_alone(self) -> None:
        assert bare_surface(SAMOTHRACE) == SAMOTHRACE

    def test_trims_stray_whitespace_in_the_same_pass(self) -> None:
        assert bare_surface(f"  {SAMOTHRACE} ,") == SAMOTHRACE

    def test_a_token_of_pure_punctuation_becomes_empty_rather_than_a_badge(self) -> None:
        assert bare_surface(" , . ") == ""
