"""One citation: a retrieved chunk, labelled the way a reader reads it.

Purpose
    The Studio Assistant never lets a claim stand without a visible source
    chip (`design-language.md` non-negotiable 3). Rather than parsing
    citations back out of the model's free-text answer -- fragile, and
    trivially hallucinatable -- every chunk actually placed in the prompt
    becomes a citation directly. What was retrieved is what is cited; the two
    can never drift apart because they are the same list.

Dependencies
    The retrieval module's RetrievedChunk, and the scripture domain's
    reference-label formatter (the same one badges' cross-reference records
    use, so a verse reads identically everywhere it is cited).

Usage
    citations = [Citation.from_chunk(chunk) for chunk in retrieved]
"""

from __future__ import annotations

from dataclasses import dataclass

from ...retrieval.application import RetrievedChunk
from ...scripture.domain import display_reference


@dataclass(frozen=True, slots=True)
class Citation:
    """A retrieved chunk, as a reader-facing source chip."""

    ref_key: str
    label: str
    verse_key: int | None
    score: float

    @staticmethod
    def from_chunk(chunk: RetrievedChunk) -> Citation:
        """Build a citation from a retrieved chunk.

        `verse_key` is optional on `RetrievedChunk` (some future `kind` might
        not anchor to one verse); without it, the passage's own `ref_key` is
        the only label available.
        """
        label = (
            display_reference(chunk.verse_key, chunk.verse_key)
            if chunk.verse_key is not None
            else chunk.ref_key
        )
        return Citation(
            ref_key=chunk.ref_key,
            label=label,
            verse_key=chunk.verse_key,
            score=chunk.score,
        )
