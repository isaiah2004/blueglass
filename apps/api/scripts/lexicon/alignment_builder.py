"""Build the English-to-Greek alignment row-set, and measure its coverage.

Purpose
    Run `gloss_alignment` over every New Testament verse of every loaded
    translation and report, per translation, how much of the text it managed to
    anchor. The measurement is part of the product, not just of the report: a
    badge may only render on a word this table covers, so coverage IS the Root
    badge's reach.

Key responsibilities
    - Read the verses to align (New Testament only -- no Hebrew word data has
      been acquired, see the ingest report).
    - Turn each alignment into a row, and each translation into a coverage line.

Dependencies
    asyncpg for reading verses, `gloss_alignment` for the rule itself.

Usage
    rows, coverage = await build_alignments(connection, words)
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass

import asyncpg

from .gloss_alignment import align_verse, content_token_count
from .tagnt_parser import TagntWord

#: Matthew. Alignment is Greek-only because TAHOT (the Hebrew word layer) is not
#: among the acquired files; see data/raw/stepbible/PROVENANCE.md.
FIRST_NT_BOOK_NUMBER = 40

_SELECT_NT_VERSES = """
    SELECT translation, verse_key, text
      FROM verses
     WHERE book_number >= $1
     ORDER BY translation, verse_key
"""


@dataclass(frozen=True, slots=True)
class AlignmentRow:
    """One English word, resolved to one original word of the same verse."""

    translation: str
    verse_key: int
    token_index: int
    token: str
    char_start: int
    char_end: int
    word_index: int
    method: str
    confidence: float


@dataclass(frozen=True, slots=True)
class TranslationCoverage:
    """What the alignment achieved for one translation. Measured, not expected."""

    translation: str
    verses: int
    verses_with_any: int
    content_tokens: int
    aligned_tokens: int

    @property
    def verse_share(self) -> float:
        """Share of New Testament verses carrying at least one tappable word."""
        return self.verses_with_any / self.verses if self.verses else 0.0

    @property
    def token_share(self) -> float:
        """Share of content words that resolved to an original-language word."""
        return self.aligned_tokens / self.content_tokens if self.content_tokens else 0.0


def _glosses_by_verse(words: Sequence[TagntWord]) -> dict[int, list[tuple[int, str]]]:
    """Group the tagged words by verse, keeping original word order."""
    grouped: dict[int, list[tuple[int, str]]] = defaultdict(list)
    for word in words:
        grouped[word.verse_key].append((word.word_index, word.gloss))
    return grouped


async def build_alignments(
    connection: asyncpg.Connection, words: Sequence[TagntWord]
) -> tuple[list[AlignmentRow], list[TranslationCoverage]]:
    """Align every loaded translation's New Testament against the Greek words."""
    glosses = _glosses_by_verse(words)
    rows: list[AlignmentRow] = []
    tallies: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0, 0])
    verses = await connection.fetch(_SELECT_NT_VERSES, FIRST_NT_BOOK_NUMBER)
    for verse in verses:
        verse_glosses = glosses.get(verse["verse_key"])
        if not verse_glosses:
            continue
        tally = tallies[verse["translation"]]
        tally[0] += 1
        tally[2] += content_token_count(verse["text"])
        found = align_verse(verse["text"], verse_glosses)
        if found:
            tally[1] += 1
            tally[3] += len(found)
        rows.extend(
            AlignmentRow(
                translation=verse["translation"],
                verse_key=verse["verse_key"],
                token_index=alignment.token.index,
                token=alignment.token.word,
                char_start=alignment.token.char_start,
                char_end=alignment.token.char_end,
                word_index=alignment.word_index,
                method=alignment.method,
                confidence=alignment.confidence,
            )
            for alignment in found
        )
    coverage = [
        TranslationCoverage(translation, tally[0], tally[1], tally[2], tally[3])
        for translation, tally in sorted(tallies.items())
    ]
    return rows, coverage
