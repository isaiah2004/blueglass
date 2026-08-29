"""The alignment rule, which decides which English word a reader may tap.

Precision matters more than coverage here: a wrong pairing shows the reader a
Greek word that is not behind the word they tapped, which is worse than showing
no badge at all. Most of these tests therefore assert that something is NOT
aligned.
"""

from __future__ import annotations

from scripts.lexicon.gloss_alignment import (
    EXACT_METHOD,
    STEM_METHOD,
    align_verse,
    content_token_count,
    gloss_tokens,
    stem,
    tokenise,
)

#: BSB Acts 16:14 and the glosses TAGNT gives its Greek words. This is the
#: mockup's own example (docs/product/mockups/image6.png).
_ACTS_16_14 = (
    "Among those listening was a woman named Lydia, a dealer in purple cloth "
    "from the city of Thyatira, who was a worshiper of God."
)
_ACTS_16_14_GLOSSES = [
    (1, "And"),
    (2, "a certain"),
    (3, "woman"),
    (4, "named"),
    (5, "Lydia,"),
    (6, "a seller of purple"),
    (7, "of [the] city"),
    (8, "of Thyatira"),
    (9, "worshiping"),
    (10, "<the>"),
    (11, "God,"),
    (12, "was listening"),
]


def _by_token(text: str, glosses: list[tuple[int, str]]) -> dict[str, int]:
    return {found.token.word: found.word_index for found in align_verse(text, glosses)}


def test_tokens_keep_the_character_span_the_reader_will_tap() -> None:
    tokens = tokenise("Among those listening")
    assert [token.word for token in tokens] == ["among", "those", "listening"]
    assert "Among those listening"[tokens[2].char_start : tokens[2].char_end] == ("listening")


def test_the_mockup_case_resolves_to_the_right_greek_word() -> None:
    """BSB "worshiper" must reach σεβομένη (word 9), not any other word."""
    assert _by_token(_ACTS_16_14, _ACTS_16_14_GLOSSES)["worshiper"] == 9


def test_content_words_align_and_function_words_never_do() -> None:
    aligned = _by_token(_ACTS_16_14, _ACTS_16_14_GLOSSES)
    assert aligned["woman"] == 3
    assert aligned["lydia"] == 5
    assert aligned["thyatira"] == 8
    assert aligned["god"] == 11
    assert "the" not in aligned
    assert "of" not in aligned
    assert "was" not in aligned


def test_an_english_word_appearing_twice_is_left_unaligned() -> None:
    """Two candidates in the English means we cannot know which one it renders."""
    assert _by_token("light and light", [(1, "light"), (2, "and")]) == {}


def test_a_word_claimed_by_two_greek_glosses_is_left_unaligned() -> None:
    """Two candidates in the Greek is the same ambiguity, seen from the other side."""
    assert _by_token("bread", [(1, "bread"), (2, "the bread")]) == {}


def test_supplied_words_in_a_gloss_do_not_pull_an_alignment() -> None:
    """`[the] city` and `<the>` are the translator's English, not the Greek."""
    assert gloss_tokens("of [the] city") == ["city"]
    assert gloss_tokens("<the>") == []


def test_two_english_words_may_render_one_greek_word() -> None:
    """KJV's "seller of purple" is a single noun, πορφυρόπωλις."""
    aligned = _by_token("a seller of purple", [(1, "a certain"), (6, "a seller of purple")])
    assert aligned == {"seller": 6, "purple": 6}


def test_the_stem_pass_only_runs_where_the_exact_pass_found_nothing() -> None:
    found = align_verse(_ACTS_16_14, _ACTS_16_14_GLOSSES)
    methods = {alignment.token.word: alignment.method for alignment in found}
    assert methods["woman"] == EXACT_METHOD
    assert methods["worshiper"] == STEM_METHOD


def test_alignments_come_back_in_reading_order_with_no_token_twice() -> None:
    found = align_verse(_ACTS_16_14, _ACTS_16_14_GLOSSES)
    indexes = [alignment.token.index for alignment in found]
    assert indexes == sorted(indexes)
    assert len(indexes) == len(set(indexes))


def test_a_stem_never_eats_a_short_word_down_to_nothing() -> None:
    assert stem("the") == "the"
    assert stem("was") == "was"
    assert stem("worshiping") == "worship"
    assert stem("worshiper") == "worship"


def test_the_coverage_denominator_counts_only_alignable_words() -> None:
    assert content_token_count("Among those listening was a woman") == 2
