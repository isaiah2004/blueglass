"""The anchor rules: exact, stable, and refusing offsets that do not verify."""

from __future__ import annotations

from app.modules.badges.domain import (
    name_anchor,
    normalise_name,
    span_anchor,
    tail_anchor,
)

VERSE = 44016014
TEXT = (
    "Among those listening was a woman named Lydia, a dealer in purple cloth "
    "from the city of Thyatira."
)
#: BSB punctuates possessives with U+2019, not an ASCII apostrophe. Built by
#: codepoint so the file stays plain ASCII while the test still exercises the
#: real character -- the one the word regex has to treat as INSIDE a word.
RIGHT_QUOTE = chr(0x2019)
POSSESSIVE = f"he answered Paul{RIGHT_QUOTE}s"


def test_tail_anchor_selects_the_last_word() -> None:
    anchor = tail_anchor(VERSE, TEXT)

    assert anchor is not None
    assert anchor.text == "Thyatira"
    assert TEXT[anchor.start_offset : anchor.end_offset] == "Thyatira"


def test_tail_anchor_keeps_a_possessive_whole() -> None:
    """A curly apostrophe is inside the word, not a boundary."""
    anchor = tail_anchor(VERSE, POSSESSIVE)

    assert anchor is not None
    assert anchor.text == f"Paul{RIGHT_QUOTE}s"


def test_tail_anchor_of_a_wordless_verse_is_none() -> None:
    assert tail_anchor(VERSE, "   ---   ") is None


def test_anchors_are_identical_across_calls() -> None:
    """The stability contract, asserted directly on the pure functions."""
    assert tail_anchor(VERSE, TEXT) == tail_anchor(VERSE, TEXT)
    spellings = frozenset({"thyatira"})
    assert name_anchor(VERSE, TEXT, spellings) == name_anchor(VERSE, TEXT, spellings)


def test_name_anchor_finds_the_first_occurrence() -> None:
    text = "From Troas they sailed, and from Troas again."
    anchor = name_anchor(VERSE, text, frozenset({"troas"}))

    assert anchor is not None
    assert anchor.start_offset == text.index("Troas")


def test_name_anchor_prefers_the_longer_phrase() -> None:
    """Alexandria Troas must not be anchored as its second word."""
    text = "They came to Alexandria Troas that week."
    anchor = name_anchor(VERSE, text, frozenset({"troas", "alexandriatroas"}))

    assert anchor is not None
    assert anchor.text == "Alexandria Troas"


def test_name_anchor_ignores_an_unnamed_place() -> None:
    """Acts 16:9 mentions Greece without spelling it. Nothing to tint."""
    text = "Paul had a vision of a man of Macedonia standing and pleading."

    assert name_anchor(VERSE, text, frozenset({"greece"})) is None


def test_name_anchor_matches_across_punctuation_and_accents() -> None:
    text = "They reached Beth-shan, at last."

    anchor = name_anchor(VERSE, text, frozenset({normalise_name("Bethshān")}))
    assert anchor is not None
    assert anchor.text == "Beth-shan"


def test_span_anchor_accepts_a_verified_range() -> None:
    start = TEXT.index("purple")
    anchor = span_anchor(VERSE, TEXT, start, start + len("purple"))

    assert anchor is not None
    assert anchor.text == "purple"


def test_span_anchor_rejects_a_range_that_is_not_a_word() -> None:
    """Stored offsets that straddle a word boundary describe another text."""
    start = TEXT.index("purple")

    assert span_anchor(VERSE, TEXT, start, start + 3) is None
    assert span_anchor(VERSE, TEXT, start - 1, start + 6) is None


def test_span_anchor_rejects_out_of_bounds() -> None:
    assert span_anchor(VERSE, TEXT, 0, len(TEXT) + 5) is None
    assert span_anchor(VERSE, TEXT, 10, 4) is None
    assert span_anchor(VERSE, TEXT, -1, 4) is None


def test_normalise_matches_the_gazetteer_folding() -> None:
    assert normalise_name("Beth-shan") == "bethshan"
    assert normalise_name("The Great Sea") == "greatsea"
    assert normalise_name("Alexandria Troas") == "alexandriatroas"
