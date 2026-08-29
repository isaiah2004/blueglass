"""Decide which English word in a verse renders which Greek word.

Purpose
    The Root badge is a tap on a word. Nothing in the acquired data says which
    English word a Greek word became, so this computes it -- deterministically,
    with no model involved (AI-07).

Why this is possible at all
    TAGNT's English column is not a lexicon gloss. Its own field description
    reads: "English: Based on Berean Study Bible, with permission, as at
    1-July-2019 and adapted for this work." It is a real English rendering,
    already split across the Greek words. Aligning it to a translation's text is
    therefore mostly a matching problem, not a translation problem.

The rule, and why it is deliberately timid
    A wrong alignment shows the reader the wrong Greek word, which is worse than
    showing none. So a pairing is emitted ONLY when it is unambiguous in both
    directions: the English token occurs exactly once in the verse, AND exactly
    one Greek word's gloss contains it. Everything else is dropped. Function
    words are excluded outright -- "the" is unalignable and carries no root
    worth tapping -- and bracketed supplied words (`<the>`, `[the] city`) are
    stripped from the gloss before matching, because they are the translator's
    English, not the Greek word's.

    A second, lower-confidence pass repeats the same uniqueness test on lightly
    stemmed tokens, which is what lets BSB's "worshiper" reach TAGNT's
    "worshiping" (σεβομένη, G4576) -- the exact case in the target mockup.

Dependencies
    Standard library only. Pure functions, so the whole rule is unit-testable
    without a database.

Usage
    for pairing in align_verse(text, [(1, "And"), (3, "woman")]):
        ...
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass

#: Words the Greek article, particles and prepositions scatter through a verse.
#: Excluded from alignment entirely: they are never the word a reader taps for a
#: root, and they are the dominant source of a plausible-but-wrong pairing.
STOPWORDS: frozenset[str] = frozenset(
    """
    a an the and or but of to in on at by for with from as is are was were be been
    being am he she it they we you i him her them us me his hers its their our your
    my thee thou thy ye this that these those which who whom whose what not no nor
    so then than there here if when while will shall may might can could would
    should do does did have has had one all any some such into unto upon out up
    down over under about after before against among between through
    """.split()
)

#: Longest-first, so "ings" is tried before "ing" and "ers" before "er".
_SUFFIXES: tuple[str, ...] = ("ings", "ing", "edly", "eth", "ers", "er", "ed", "es", "s", "ly")

#: A stem must keep at least this many characters, so "the" never becomes "th".
_MINIMUM_STEM = 3

#: Words the translator supplied, marked by the source as `<the>`, `[the]` or
#: `(the)`. They belong to the English, not to the Greek word, so they must not
#: pull a pairing towards the wrong lemma.
_SUPPLIED = re.compile(r"[\[<(][^\]>)]*[\]>)]")

_WORD = re.compile(r"[A-Za-z][A-Za-z']*")

EXACT_METHOD = "gloss-exact"
STEM_METHOD = "gloss-stem"
EXACT_CONFIDENCE = 1.0
STEM_CONFIDENCE = 0.8


@dataclass(frozen=True, slots=True)
class EnglishToken:
    """One word of a translation's verse text, with its character span."""

    index: int
    word: str
    char_start: int
    char_end: int


@dataclass(frozen=True, slots=True)
class Alignment:
    """One English token, resolved to one original-language word index."""

    token: EnglishToken
    word_index: int
    method: str
    confidence: float


def tokenise(text: str) -> list[EnglishToken]:
    """Split a verse into lower-cased words that keep their character offsets."""
    return [
        EnglishToken(index, match.group(0).lower(), match.start(), match.end())
        for index, match in enumerate(_WORD.finditer(text))
    ]


def stem(word: str) -> str:
    """Strip one common English suffix, or return the word unchanged."""
    for suffix in _SUFFIXES:
        if len(word) - len(suffix) >= _MINIMUM_STEM and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def gloss_tokens(gloss: str) -> list[str]:
    """Content words of a TAGNT gloss, with supplied words removed."""
    return [
        match.group(0).lower()
        for match in _WORD.finditer(_SUPPLIED.sub(" ", gloss))
        if match.group(0).lower() not in STOPWORDS
    ]


def _index_glosses(
    glosses: Iterable[tuple[int, str]], key: Callable[[str], str]
) -> dict[str, set[int]]:
    """Map each (possibly stemmed) gloss token to the word indexes claiming it."""
    index: dict[str, set[int]] = defaultdict(set)
    for word_index, gloss in glosses:
        for token in gloss_tokens(gloss):
            index[key(token)].add(word_index)
    return index


def _pass(
    tokens: Sequence[EnglishToken],
    claimed: set[int],
    gloss_index: dict[str, set[int]],
    counts: Counter[str],
    key: Callable[[str], str],
    method: str,
    confidence: float,
) -> list[Alignment]:
    """Emit the pairings that are unique on both sides under one key function."""
    found: list[Alignment] = []
    for token in tokens:
        if token.index in claimed or token.word in STOPWORDS:
            continue
        candidate = key(token.word)
        owners = gloss_index.get(candidate)
        if counts[candidate] != 1 or owners is None or len(owners) != 1:
            continue
        found.append(Alignment(token, next(iter(owners)), method, confidence))
        claimed.add(token.index)
    return found


def align_verse(text: str, glosses: Sequence[tuple[int, str]]) -> list[Alignment]:
    """Align one verse's English text to its original words' glosses.

    `glosses` is (word_index, gloss) in original word order. The result is
    ordered by English token index and contains at most one entry per token.
    """
    tokens = tokenise(text)
    claimed: set[int] = set()
    exact = _pass(
        tokens,
        claimed,
        _index_glosses(glosses, _identity),
        Counter(token.word for token in tokens),
        _identity,
        EXACT_METHOD,
        EXACT_CONFIDENCE,
    )
    stemmed = _pass(
        tokens,
        claimed,
        _index_glosses(glosses, stem),
        Counter(stem(token.word) for token in tokens),
        stem,
        STEM_METHOD,
        STEM_CONFIDENCE,
    )
    return sorted(exact + stemmed, key=lambda found: found.token.index)


def content_token_count(text: str) -> int:
    """How many tokens in a verse were ever eligible -- the coverage denominator."""
    return sum(1 for token in tokenise(text) if token.word not in STOPWORDS)


def _identity(word: str) -> str:
    return word
