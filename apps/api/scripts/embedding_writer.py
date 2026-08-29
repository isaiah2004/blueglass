"""The upsert that puts embedding vectors into Postgres.

Purpose
    Separating the write from the orchestration keeps ingest_embeddings.py
    readable and keeps the one SQL statement that touches the `embeddings`
    table's UNIQUE(kind, ref_key, chunk_index) in a single, reviewable place --
    the same split place_writer.py makes for the gazetteer.

Key responsibilities
    Upsert rows by their natural key, so re-running the ingest (a fresh
    OpenAI response, a re-chunked passage) updates in place instead of
    accumulating duplicates or violating the unique constraint.

Dependencies
    asyncpg and the retrieval domain's to_pgvector_literal -- the same
    conversion the read-side query already trusts, so a vector never has two
    different string encodings in this codebase.

Usage
    await upsert_embeddings(connection, records)
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import asyncpg

from app.modules.retrieval.domain import to_pgvector_literal

EMBEDDING_COLUMNS = (
    "kind",
    "ref_key",
    "chunk_index",
    "content",
    "verse_key",
    "embedding",
    "source_id",
)

_UPSERT = """
    INSERT INTO embeddings
        (kind, ref_key, chunk_index, content, verse_key, embedding, source_id)
    VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
    ON CONFLICT (kind, ref_key, chunk_index) DO UPDATE SET
        content    = excluded.content,
        verse_key  = excluded.verse_key,
        embedding  = excluded.embedding,
        source_id  = excluded.source_id
"""


@dataclass(frozen=True, slots=True)
class EmbeddingRow:
    """One chunk, ready to write: a natural key plus its vector."""

    kind: str
    ref_key: str
    chunk_index: int
    content: str
    verse_key: int
    vector: list[float]
    source_id: int


async def upsert_embeddings(
    connection: asyncpg.Connection, rows: Sequence[EmbeddingRow]
) -> None:
    """Write every row's vector, one statement, keyed by its natural key."""
    if not rows:
        return
    await connection.executemany(
        _UPSERT,
        [
            (
                row.kind,
                row.ref_key,
                row.chunk_index,
                row.content,
                row.verse_key,
                to_pgvector_literal(row.vector),
                row.source_id,
            )
            for row in rows
        ],
    )
