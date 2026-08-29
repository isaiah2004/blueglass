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
    name_anchor    -- the best-attested published spelling of a place that the
                      verse actually prints, found by folding both sides to the
                      gazetteer's own normal form.
    tail_anchor    -- the last word of the verse, for a badge whose claim is
                      about the whole verse rather than about one word.

Why name_anchor is driven by the SPELLING and not by the span
    It used to scan the verse for the longest run of words whose folded form
    was attested, taking the earliest such run. Two false claims came out of
    that, and both reached the reader. Acts 28:17 spells "Jerusalem", but "the
    Jews" occurs earlier and is a weight-1 translation alias of Jerusalem, so
    the pill tinted a people-word and the sheet asserted it named a city. And
    the docstring's own example was false: `Most Holy Place` lost to the span
    `the Most Holy`, because the article was folded away AFTER the span had won
    on length. Both disappear when the loop runs over the candidate NAMES in
    rank order and asks where each one occurs -- longest name first, the
    place's own published name before a translation's variant, better attested
    before worse. A spelling's length is measured with the article removed, so
    the sentence's "the Jordan" cannot pull "the" into a span labelled Jordan.

Whose article is it
    Not always the sentence's. Four published spellings begin with one of their
    own -- "The Lord Will Provide" (a559399's primary name, and what Genesis
    22:14 writes), "The Lord Is There", "The Skull", "The Stone Pavement" --
    and stripping those put "LORD Will Provide" on a pin beside a verse that
    reads "The LORD Will Provide". So each spelling is tried at both lengths,
    longest first, and the capitalisation rule already in `_run_spelling`
    decides: a translation writes the name's own article with a capital and the
    sentence's without one.

Dependencies
    `place_spelling`, which owns the name-folding rules this module compares
    against. Standard library otherwise. Rule 5.1.2.

Usage
    anchor = tail_anchor(44016001, "Paul came to Derbe...")
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from .place_spelling import PlaceSpelling, normalise_name, word_spans


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
    verse_key: int, verse_text: str, spellings: Iterable[PlaceSpelling]
) -> BadgeAnchor | None:
    """Anchor on the best published spelling of a name the verse prints.

    Longest name first, so "Alexandria Troas" is not anchored as "Troas" when
    both are attested for the same place; then the place's own name before a
    translation's variant, so Acts 28:17 tints "Jerusalem" and not the alias
    that happens to occur earlier in the verse; then the better attested of two
    variants; then the folded key, so the choice is total and reproducible.

    @param verse_key: The verse being scanned.
    @param verse_text: Its text.
    @param spellings: The spellings a badge is allowed to claim. Filter them
        with `spellings.anchorable` first -- this function asks only where a
        name occurs, never whether it may be shown.
    @returns The anchor over the first occurrence of the best spelling, or None
        when the verse prints none of them. The span never begins lower-case,
        and includes a leading article only when the name owns one and the text
        capitalises it. Side effects: none.
    """
    spans = word_spans(verse_text)
    for spelling in sorted(spellings, key=_spelling_order):
        hit = _first_occurrence(verse_text, spans, spelling)
        if hit is not None:
            return BadgeAnchor(verse_key, verse_text[hit[0] : hit[1]], hit[0], hit[1])
    return None


def _spelling_order(spelling: PlaceSpelling) -> tuple[int, int, int, str]:
    """The order candidate spellings are tried in. See `name_anchor`."""
    return (
        -spelling.words,
        0 if spelling.is_primary else 1,
        -spelling.attestation,
        spelling.normalised,
    )


def _first_occurrence(
    verse_text: str,
    spans: tuple[tuple[int, int], ...],
    spelling: PlaceSpelling,
) -> tuple[int, int] | None:
    """The earliest run of words that spells this name, or None.

    Tried at the name's full length first, then without its own article, so an
    article that belongs to the NAME survives into the span and one that
    belongs to the SENTENCE does not. The text decides which it is: Genesis
    22:14 writes "The LORD Will Provide" and John 19:13 writes "at a place
    called the Stone Pavement", and only the first is the place spelling its
    own article.
    """
    for length in _candidate_lengths(spelling):
        found = _run_spelling(verse_text, spans, spelling.normalised, length)
        if found is not None:
            return found
    return None


def _candidate_lengths(spelling: PlaceSpelling) -> tuple[int, ...]:
    """How many words to try matching, longest first.

    One length for a name with no article of its own; two for the four that
    have one, so neither reading is assumed.
    """
    bare = spelling.words
    full = spelling.article_words
    return (full, bare) if full > bare else (bare,)


def _run_spelling(
    verse_text: str,
    spans: tuple[tuple[int, int], ...],
    normalised: str,
    length: int,
) -> tuple[int, int] | None:
    """The earliest run of `length` words folding to `normalised`, or None.

    A lower-case run is refused: every English translation capitalises a place
    name, and "toward the south" names a direction where "toward the Negev"
    names a place -- only the second is a claim a badge may make (`Negeb`
    publishes "South" as a spelling, weight 39). That same rule is what tells
    the name's article from the sentence's.
    """
    if length < 1 or length > len(spans):
        return None
    for index in range(len(spans) - length + 1):
        start = spans[index][0]
        end = spans[index + length - 1][1]
        if normalise_name(verse_text[start:end]) != normalised:
            continue
        if not verse_text[start : start + 1].isupper():
            continue
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
