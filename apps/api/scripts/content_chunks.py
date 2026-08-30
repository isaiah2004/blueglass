"""Split a passage's verses into embeddable chunks. Pure and untestable-free.

Purpose
    The embedding vendor (Q-010) is billed and rate-limited per input, and a
    single vector must describe a bounded amount of text to stay meaningful.
    This module decides where a passage's text is cut; nothing else does, so
    the boundary logic exists in exactly one place.

Key responsibilities
    Turn one passage's ordered verses into one or more Chunk rows, each under
    a character budget, greedily -- never split a verse itself, since a
    citation must always resolve to whole verses.

Dependencies
    None. No asyncpg, no settings, no I/O -- this is why it is trivial to
    exhaustively unit test (tests/unit/test_content_chunks.py) without a
    database or an API key.

Usage
    chunks = chunk_passage(verses)
    for chunk in chunks:
        ...  # embed chunk.content, write chunk.chunk_index / chunk.verse_key
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

#: Acts pericopes run a handful of verses (data-inventory.md), so this budget
#: is deliberately generous -- it exists to bound a future book, not Acts
#: itself, and a defect here would otherwise stay invisible until one did.
MAX_CHUNK_CHARS = 2000


@dataclass(frozen=True, slots=True)
class VerseText:
    """One verse's text, the smallest unit a chunk may end on."""

    verse_key: int
    text: str


@dataclass(frozen=True, slots=True)
class Chunk:
    """One embeddable unit: some whole verses, joined, under the budget."""

    chunk_index: int
    verse_key: int  # the first verse in this chunk -- where its citation points
    content: str


def chunk_passage(
    verses: Sequence[VerseText], *, max_chars: int = MAX_CHUNK_CHARS
) -> list[Chunk]:
    """Greedily pack whole verses into chunks no longer than ``max_chars``.

    A single verse longer than the budget still becomes its own chunk --
    truncating it would make the embedding describe less than the citation
    it is filed under, which is worse than one oversized request.
    """
    if not verses:
        return []
    chunks: list[Chunk] = []
    current: list[VerseText] = []
    current_chars = 0
    for verse in verses:
        added_length = len(verse.text) + (1 if current else 0)  # +1 join space
        if current and current_chars + added_length > max_chars:
            chunks.append(_join(len(chunks), current))
            current, current_chars = [], 0
            added_length = len(verse.text)
        current.append(verse)
        current_chars += added_length
    if current:
        chunks.append(_join(len(chunks), current))
    return chunks


def _join(chunk_index: int, verses: list[VerseText]) -> Chunk:
    return Chunk(
        chunk_index=chunk_index,
        verse_key=verses[0].verse_key,
        content=" ".join(verse.text for verse in verses),
    )
