"""Ports and result types for retrieval."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class RetrievedChunk:
    """One retrieved passage, with its relevance score in [0, 1]."""

    kind: str
    ref_key: str
    chunk_index: int
    content: str
    verse_key: int | None
    score: float


class EmbeddingRepository(Protocol):
    """Nearest-neighbour search over the embeddings table."""

    async def nearest(
        self,
        *,
        embedding: list[float],
        limit: int,
        kinds: Sequence[str] | None = None,
    ) -> Sequence[RetrievedChunk]:
        """The most similar chunks, most relevant first."""
        ...


class EmbeddingClient(Protocol):
    """Text in, vectors out. The one seam between this codebase and a paid
    vendor (`Q-010`).

    One protocol serves both directions the app needs -- a user's chat
    query and an ingest script's content chunks -- because embedding text is
    the same operation either way; a second, near-identical interface would
    only be one more place for the model name or dimension to drift.
    """

    async def embed(self, texts: Sequence[str]) -> Sequence[list[float]]:
        """One vector per input text, in the same order."""
        ...
