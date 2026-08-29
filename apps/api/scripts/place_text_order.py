"""Order the places named in one verse by where they appear in that verse.

Purpose
    A route is only honest if its order came from scripture. The gazetteer says
    Acts 16:11 names Troas, Samothrace and Neapolis; it does not say in which
    order, because it records the verse and not the word. Sorting those three
    by name would print "Neapolis, Samothrace, Troas" -- the journey backwards.
    This finds each place's earliest occurrence in the verse text instead, so
    the sequence is read out of the Bible rather than guessed or generated.

Key responsibilities
    - Match any published spelling of a place against a verse's text, on word
      boundaries, case- and accent-insensitively.
    - Return a rank a sort can use, and a sentinel for "not found in the text".
    - Count what it matched, so a caller can assert the coverage rather than
      hope for it.

Dependencies
    Standard library only. Verse texts are passed in; nothing here reads a
    database.

Usage
    order = WithinVerseOrder(texts, spellings)
    order.rank(44016011, "a49e1d0")
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Mapping, Sequence

#: Rank given to a place the verse text does not spell out. Larger than any
#: real character offset, so unmatched places sort after matched ones and the
#: caller's own tie-break decides among them.
NOT_IN_TEXT = 1_000_000


def _fold(text: str) -> str:
    """Lowercase and strip accents so "Beth-shan" matches "Beth-shān"."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(
        character for character in decomposed if not unicodedata.combining(character)
    )


def _pattern_for(spellings: Sequence[str]) -> re.Pattern[str] | None:
    """One alternation matching any spelling of a place, on word boundaries.

    Word boundaries matter: without them "Asia" matches inside "Asiarch" and
    "Dan" matches inside "danced", which would move a stop to the wrong verse
    position with complete confidence.
    """
    folded = sorted({_fold(name) for name in spellings if name.strip()}, key=len)
    if not folded:
        return None
    alternation = "|".join(re.escape(name) for name in reversed(folded))
    return re.compile(rf"(?<!\w)(?:{alternation})(?!\w)")


class WithinVerseOrder:
    """Ranks the places of one verse by their position in its text."""

    __slots__ = ("_considered", "_matched", "_patterns", "_texts")

    def __init__(
        self, texts: Mapping[int, str], spellings: Mapping[str, Sequence[str]]
    ) -> None:
        self._texts = {key: _fold(text) for key, text in texts.items()}
        self._patterns = {
            place_id: pattern
            for place_id, names in spellings.items()
            if (pattern := _pattern_for(names)) is not None
        }
        self._matched = 0
        self._considered = 0

    @property
    def matched(self) -> int:
        """How many rank() calls found the place in the verse text."""
        return self._matched

    @property
    def considered(self) -> int:
        """How many rank() calls were made in total."""
        return self._considered

    @property
    def match_rate(self) -> float:
        """Fraction of ranked mentions the text actually spelled out."""
        return 0.0 if not self._considered else self._matched / self._considered

    def rank(self, verse_key: int, place_id: str) -> int:
        """The character offset of this place in this verse, or NOT_IN_TEXT.

        Nothing is inferred when the text does not name the place. A verse can
        refer to a region without spelling it -- the gazetteer records the
        reference, the text does not carry the word -- and inventing a position
        for it would fabricate an ordering the source does not support.
        """
        self._considered += 1
        text = self._texts.get(verse_key)
        pattern = self._patterns.get(place_id)
        if text is None or pattern is None:
            return NOT_IN_TEXT
        found = pattern.search(text)
        if found is None:
            return NOT_IN_TEXT
        self._matched += 1
        return found.start()


#: The order to use when no verse text is available. Every place ranks equal,
#: so the caller's tie-break -- place name -- decides alone.
def alphabetical_only() -> WithinVerseOrder:
    """A WithinVerseOrder that never matches, for parsing without a database."""
    return WithinVerseOrder({}, {})
