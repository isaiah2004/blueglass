"""What counts as a name of a place, and how two spellings of one are compared.

Purpose
    `place_names` publishes several spellings per place -- its own name, each
    translation's variant, the modern site's name -- and a badge has to weigh
    them against each other and against the words of a verse. That weighing is
    string rules, not character offsets, so it lives here and `anchor.py` uses
    it. Splitting them also keeps either file readable in one sitting.

The folding rules, and why they mirror the loader
    `normalise_name` reimplements `scripts/place_gazetteer.normalise_place_name`
    exactly, including its 64-character truncation, because a key folded any
    differently would miss the row the loader wrote. The loader is a script and
    the domain may not import one (rule 5.1.2), so the rule is stated twice and
    pinned by tests on both sides.

Dependencies
    Standard library only. Rule 5.1.2.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

#: A word: letters, plus the internal apostrophes and hyphens English and
#: transliterated Semitic names carry. Digits are excluded -- a verse number
#: leaking into the text is not a word a badge should annotate.
_WORD = re.compile(r"[^\W\d_]+(?:['\u2019\u02bc-][^\W\d_]+)*", re.UNICODE)

#: Articles the gazetteer strips before indexing. Repeated rather than imported
#: because `scripts/` is a loader, not a dependency the domain may take.
_LEADING_ARTICLES = ("the ", "el-", "el ", "al-", "al ")

#: The gazetteer truncates its index key. Matching that exactly is what makes a
#: lookup here hit a row the loader wrote.
_MAX_NORMALISED_LENGTH = 64

#: `place_names.kind` for the place's own published name.
PRIMARY_SPELLING = "primary"


@dataclass(frozen=True, slots=True)
class PlaceSpelling:
    """One row of `place_names`: a spelling, and the evidence behind it.

    `attestation` is how many of OpenBible's ten surveyed translations spell
    this place this way, counted over the whole canon. It is the number the
    admissibility gates in `spellings.py` weigh, and it is why a spelling has
    to travel as a record rather than as a bare folded key: "Jews" and
    "Jerusalem" are both spellings of Jerusalem, and the difference between
    them -- 1 use against 7,819 -- is the entire difference between a false
    claim and a true one.
    """

    #: The folded index key, as `place_names.normalised` holds it.
    normalised: str
    #: The spelling as published, for measuring how many words it is.
    name: str
    #: `place_names.kind`: `primary` for the place's own name, else `translation`.
    kind: str
    #: How many translation uses the gazetteer counted for this spelling.
    attestation: int
    #: True when some OTHER place publishes this string as its own name.
    names_another_place: bool = False

    @property
    def is_primary(self) -> bool:
        """True for the place's own published name."""
        return self.kind == PRIMARY_SPELLING

    @property
    def words(self) -> int:
        """How many words the name is, with a leading article excluded.

        The article usually belongs to the sentence, not to the name, so it is
        not part of the span a badge tints and not part of the length a longer
        name has to beat. This stays the SHORT measure even for a name that
        owns its article, because it is what a rival spelling has to beat.
        """
        return len(word_spans(strip_leading_article(self.name)))

    @property
    def article_words(self) -> int:
        """How many words the name is WITH its own leading article.

        Equal to `words` for a name that has none, which is every published
        spelling but four.
        """
        return len(word_spans(self.name))


def normalise_name(name: str) -> str:
    """Fold a spelling to the gazetteer's index key.

    Reimplements `scripts/place_gazetteer.normalise_place_name`. Accents are
    stripped because the same place is published as "Beth-shan" here and
    "Bethshan" elsewhere; punctuation is dropped because hyphen placement in a
    transliterated name is a house style, not a fact.

    @param name: Any spelling, from the text or from the gazetteer.
    @returns The folded key, capped at the loader's length. Side effects: none.
    """
    stripped = strip_leading_article(name.strip().lower())
    decomposed = unicodedata.normalize("NFKD", stripped)
    folded = "".join(
        character
        for character in decomposed
        if character.isalnum() and not unicodedata.combining(character)
    )
    return folded[:_MAX_NORMALISED_LENGTH]


def strip_leading_article(name: str) -> str:
    """Drop a leading article, which usually belongs to the sentence.

    Usually, not always: four published spellings begin with an article of
    their own ("The Lord Will Provide"), and `PlaceSpelling.article_words` is
    how a caller asks for the unstripped length. This function itself is
    unconditional, because the gazetteer's index key is folded the same way on
    both sides and a key that kept the article would miss its own row.

    @param name: Any spelling.
    @returns It, without the article. Side effects: none.
    """
    lowered = name.lower()
    for article in _LEADING_ARTICLES:
        if lowered.startswith(article):
            return name[len(article) :]
    return name


def word_spans(verse_text: str) -> tuple[tuple[int, int], ...]:
    """Every word in the verse as a (start, end) pair, in reading order."""
    return tuple((match.start(), match.end()) for match in _WORD.finditer(verse_text))
