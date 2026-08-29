"""pgvector implementation of the EmbeddingRepository port.

Purpose
    Replace the prototype's Chroma store (data-inventory.md section 7) and, with
    it, the wrong relevance arithmetic described in
    app/modules/retrieval/domain/similarity.py.

How correctness is enforced here
    - The ORDER BY is built from COSINE_DISTANCE_OPERATOR, the same constant the
      score function is documented against. There is no second place to spell
      the operator, so the pair cannot drift.
    - The migration that creates the index uses COSINE_INDEX_OPCLASS. An index
      built for L2 would silently not be used by <=>; an integration test
      asserts the opclass on the live index.
    - The score is computed by relevance_from_cosine_distance, never inline.

Dependencies
    The shared Database wrapper and the retrieval domain.

Usage
    repository = PgVectorEmbeddingRepository(database)
"""

from __future__ import annotations

from collections.abc import Sequence

import asyncpg

from ....infrastructure.db import Database
from ...retrieval.domain import (
    COSINE_DISTANCE_OPERATOR,
    relevance_from_cosine_distance,
    to_pgvector_literal,
)
from ..application.ports import RetrievedChunk

# S608 (SQL built by string formatting) is suppressed deliberately and only
# here: the ONLY interpolated value is COSINE_DISTANCE_OPERATOR, a module
# constant that no request can reach. Every caller-supplied value crosses as
# a bound parameter. The alternative -- writing <=> as a literal in two
# places -- is what lets the operator and the score maths drift apart, which
# is exactly the defect this module exists to prevent.
_NEAREST = f"""
    SELECT kind,
           ref_key,
           chunk_index,
           content,
           verse_key,
           embedding {COSINE_DISTANCE_OPERATOR} $1::vector AS distance
    FROM embeddings
    WHERE ($3::text[] IS NULL OR kind = ANY($3::text[]))
    ORDER BY embedding {COSINE_DISTANCE_OPERATOR} $1::vector
    LIMIT $2
"""


class PgVectorEmbeddingRepository:
    """Nearest-neighbour search over the embeddings table."""

    def __init__(self, database: Database) -> None:
        self._db = database

    async def nearest(
        self,
        *,
        embedding: list[float],
        limit: int,
        kinds: Sequence[str] | None = None,
    ) -> Sequence[RetrievedChunk]:
        rows = await self._db.fetch(
            _NEAREST,
            to_pgvector_literal(embedding),
            limit,
            list(kinds) if kinds else None,
        )
        return [self._to_chunk(row) for row in rows]

    @staticmethod
    def _to_chunk(row: asyncpg.Record) -> RetrievedChunk:
        return RetrievedChunk(
            kind=row["kind"],
            ref_key=row["ref_key"],
            chunk_index=row["chunk_index"],
            content=row["content"],
            verse_key=row["verse_key"],
            score=relevance_from_cosine_distance(float(row["distance"])),
        )
