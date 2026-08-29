"""Where a badge sits in the text, and the three rules that decide it.

Purpose
    `design-language.md` section 5: the annotated word is tinted in the badge's
    hue and the pill sits immediately after it. That needs character offsets
    into the verse, not just a word -- the same word can occur twice in one
    verse. This module produces those offsets, and it is the only place that
    does, so "stable anchors" is a property of one file rather than of five.

The stability contract
    Every function here is pure and total: same verse text plus same inputs
    gives the same anchor, forever. Nothing consults a clock, a random source,
    or a database. Two calls a week apart place the pill on the same character,
    which is what stops the reading experience shifting under the reader.

The three rules
    span_anchor    -- an exact character range a source already computed
                      (verse_word_alignments). Verified against the text, never
                      trusted: a tokeniser drift would silently mis-highlight.
    name_anchor    -- the first attested spelling of a place, found by folding
                      both sides to the gazetteer's own normal form.
    tail_anchor    -- the last word of the verse, for a badge whose claim is
                      about the whole verse rather than about one word.

Dependencies
    Standard library only. Rule 5.1.2.

Usage
    anchor = tail_anchor(44016001, "Paul came to Derbe...")
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

#: A word: letters, plus the internal apostrophes and hyphens English and
#: transliterated Semitic names carry. Digits are excluded -- a verse number
#: leaking into the text is not a word a badge should annotate.
_WORD = re.compile(r"[^\W\d_]+(?:['\u2019\u02bc-][^\W\d_]+)*", re.UNICODE)

#: Longest place name, in words, the gazetteer publishes ("Alexandria Troas").
_MAX_NAME_WORDS = 3

#: Articles the gazetteer strips before indexing. Repeated rather than imported
#: because `scripts/` is a loader, not a dependency the domain may take.
_LEADING_ARTICLES = ("the ", "el-", "el ", "al-", "al ")

#: The gazetteer truncates its index key. Matching that exactly is what makes a
#: lookup here hit a row the loader wrote.
_MAX_NORMALISED_LENGTH = 64


@dataclass(frozen=True, slots=True)
class BadgeAnchor:
    """A badge's position: an exact half-open character range in one verse."""

    verse_key: int
    text: str
    start_offset: int
    end_offset: int

    @property
    def span(self) -> tuple[int, int]:
        """The range, for comparing two anchors for collision."""
        return (self.start_offset, self.end_offset)


def normalise_name(name: str) -> str:
    """Fold a spelling to the gazetteer's index key.

    Reimplements `scripts/place_gazetteer.normalise_place_name`. Accents are
    stripped because the same place is published as "Beth-shan" here and
    "Bethshan" elsewhere; punctuation is dropped because hyphen placement in a
    transliterated name is a house style, not a fact.

    @param name: Any spelling, from the text or from the gazetteer.
    @returns The folded key, capped at the loader's length. Side effects: none.
    """
    stripped = name.strip().lower()
    for article in _LEADING_ARTICLES:
        if stripped.startswith(article):
            stripped = stripped[len(article) :]
            break
    decomposed = unicodedata.normalize("NFKD", stripped)
    folded = "".join(
        character
        for character in decomposed
        if character.isalnum() and not unicodedata.combining(character)
    )
    return folded[:_MAX_NORMALISED_LENGTH]


def word_spans(verse_text: str) -> tuple[tuple[int, int], ...]:
    """Every word in the verse as a (start, end) pair, in reading order."""
    return tuple((match.start(), match.end()) for match in _WORD.finditer(verse_text))


def span_anchor(verse_key: int, verse_text: str, start: int, end: int) -> BadgeAnchor | None:
    """Anchor on a range a source already computed, after checking it.

    @param verse_key: The verse the offsets belong to.
    @param verse_text: That verse's text in the requested translation.
    @param start: Source's start offset, 0-based.
    @param end: Source's end offset, one past the last character.
    @returns The anchor, or None when the range is out of bounds, inverted, or
        does not sit on a word -- any of which means the stored offsets describe
        a different text than the one being rendered. Side effects: none.
    """
    if not 0 <= start < end <= len(verse_text):
        return None
    if (start, end) not in word_spans(verse_text):
        return None
    return BadgeAnchor(verse_key, verse_text[start:end], start, end)


def name_anchor(
    verse_key: int, verse_text: str, spellings: frozenset[str]
) -> BadgeAnchor | None:
    """Anchor on the first attested spelling of a name in the verse.

    Longest phrase first, then earliest position: "Alexandria Troas" must not be
    anchored as "Troas" when both are attested for the same place.

    @param verse_key: The verse being scanned.
    @param verse_text: Its text.
    @param spellings: Already-normalised keys from `place_names`.
    @returns The anchor over the first match, or None when no spelling occurs.
        Side effects: none.
    """
    if not spellings:
        return None
    spans = word_spans(verse_text)
    for length in range(_MAX_NAME_WORDS, 0, -1):
        hit = _first_phrase(verse_text, spans, spellings, length)
        if hit is not None:
            return BadgeAnchor(verse_key, verse_text[hit[0] : hit[1]], hit[0], hit[1])
    return None


def _first_phrase(
    verse_text: str,
    spans: tuple[tuple[int, int], ...],
    spellings: frozenset[str],
    length: int,
) -> tuple[int, int] | None:
    """The earliest run of `length` words whose folded form is attested."""
    for index in range(len(spans) - length + 1):
        start = spans[index][0]
        end = spans[index + length - 1][1]
        if normalise_name(verse_text[start:end]) in spellings:
            return (start, end)
    return None


def tail_anchor(verse_key: int, verse_text: str) -> BadgeAnchor | None:
    """Anchor on the verse's last word.

    Used by the badges whose claim is about the whole verse -- History dates a
    passage, Cross-Ref links a verse -- where tinting one mid-sentence word
    would assert a precision the data does not have. The end of the verse is
    also where a reader's eye already is when the claim becomes relevant.

    @returns The anchor, or None for a verse with no words at all.
        Side effects: none.
    """
    spans = word_spans(verse_text)
    if not spans:
        return None
    start, end = spans[-1]
    return BadgeAnchor(verse_key, verse_text[start:end], start, end)
