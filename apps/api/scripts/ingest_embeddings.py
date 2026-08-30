"""Embed and index Acts (Q-010's answer put to work).

Purpose
    M3's "re-embed" clause: read Acts' passages and their BSB text out of the
    tables ingest_places.py etc. already populated, chunk each passage,
    embed the chunks through the OpenAI client, and upsert the vectors into
    `embeddings` -- the table pgvector_embedding_repository.py already reads.

    This is a paid, one-time, admin-run indexing cost (~$1 for the whole New
    Testament per data-inventory.md; Acts alone is a fraction of that), not a
    per-user cost -- unlike the Studio Assistant's own chat calls, which are
    billed to the user later. It does not run itself: it needs
    OPENAI_API_KEY set and a live Postgres, and should only be run once a
    product owner has signed off on spending it.

Usage
    docker compose run --rm api python -m scripts.ingest_embeddings
    docker compose run --rm api python -m scripts.ingest_embeddings --dry-run

Idempotence
    One transaction: chunk, embed, then upsert by (kind, ref_key,
    chunk_index) -- ON CONFLICT DO UPDATE (embedding_writer.py). A re-run
    with a changed passage or a newer model overwrites in place; it never
    accumulates a duplicate row.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

import asyncpg

from app.config import get_settings
from app.modules.retrieval.infrastructure import EmbeddingClientError, OpenAiEmbeddingClient
from scripts.content_chunks import Chunk, VerseText, chunk_passage
from scripts.embedding_writer import EmbeddingRow, upsert_embeddings

#: Acts. Scoped to it because that is the MVP's book (PROGRESS_TRACKER.md);
#: widening this to the whole NT is one number once the MVP is proven.
BOOK_NUMBER = 44
KIND = "passage"

#: The reader's default translation (ASSUMPTIONS.md) -- embedding one
#: translation's wording keeps "what the user reads" and "what the
#: assistant retrieved" the same text.
EMBEDDING_TRANSLATION = "BSB"

_PASSAGES = """
    SELECT passage_id, start_key, end_key
    FROM passages
    WHERE book_number = $1
    ORDER BY start_key
"""
_VERSES = """
    SELECT verse_key, text FROM verses
    WHERE translation = $1 AND verse_key BETWEEN $2 AND $3
    ORDER BY verse_key
"""
_TRANSLATION_SOURCE = "SELECT source_id FROM translations WHERE code = $1"


async def _passage_verses(
    connection: asyncpg.Connection, start_key: int, end_key: int
) -> list[VerseText]:
    rows = await connection.fetch(_VERSES, EMBEDDING_TRANSLATION, start_key, end_key)
    return [VerseText(verse_key=row["verse_key"], text=row["text"]) for row in rows]


async def _translation_source_id(connection: asyncpg.Connection) -> int:
    source_id = await connection.fetchval(_TRANSLATION_SOURCE, EMBEDDING_TRANSLATION)
    if source_id is None:
        raise RuntimeError(
            f"No {EMBEDDING_TRANSLATION} translation is loaded, so its "
            "provenance row does not exist. Run: python -m scripts.load_scripture "
            f"{EMBEDDING_TRANSLATION}"
        )
    return int(source_id)


async def build_chunks(
    connection: asyncpg.Connection,
) -> list[tuple[str, Chunk]]:
    """Every (passage_id, chunk) pair for the scoped book, in passage order."""
    passages = await connection.fetch(_PASSAGES, BOOK_NUMBER)
    if not passages:
        raise RuntimeError(
            f"No passages exist for book {BOOK_NUMBER}. Run: "
            "python -m scripts.ingest_structure"
        )
    pairs: list[tuple[str, Chunk]] = []
    for passage in passages:
        verses = await _passage_verses(connection, passage["start_key"], passage["end_key"])
        for chunk in chunk_passage(verses):
            pairs.append((passage["passage_id"], chunk))
    return pairs


async def _write(connection: asyncpg.Connection, client: OpenAiEmbeddingClient) -> int:
    """Chunk, embed and upsert Acts. Returns the number of chunks written."""
    pairs = await build_chunks(connection)
    vectors = await client.embed([chunk.content for _, chunk in pairs])
    source_id = await _translation_source_id(connection)
    rows = [
        EmbeddingRow(
            kind=KIND,
            ref_key=passage_id,
            chunk_index=chunk.chunk_index,
            content=chunk.content,
            verse_key=chunk.verse_key,
            vector=list(vector),
            source_id=source_id,
        )
        for (passage_id, chunk), vector in zip(pairs, vectors, strict=True)
    ]
    async with connection.transaction():
        await upsert_embeddings(connection, rows)
    return len(rows)


async def load() -> int:
    """Embed and index Acts end to end. Returns the number of chunks written."""
    settings = get_settings()
    api_key = settings.openai_api_key.get_secret_value() if settings.openai_api_key else ""
    client = OpenAiEmbeddingClient(api_key=api_key, model=settings.embedding_model)
    connection = await asyncpg.connect(dsn=settings.dsn)
    try:
        count = await _write(connection, client)
    finally:
        await connection.close()
        await client.aclose()
    print(f"[embeddings] wrote {count} chunks for book {BOOK_NUMBER} ({KIND})", flush=True)
    return count


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Embed Acts' passages into the pgvector embeddings table."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="chunk and report counts without calling OpenAI or touching the database",
    )
    return parser.parse_args(argv)


async def _dry_run() -> int:
    connection = await asyncpg.connect(dsn=get_settings().dsn)
    try:
        pairs = await build_chunks(connection)
    finally:
        await connection.close()
    print(
        f"[embeddings] dry run: {len(pairs)} chunks across book {BOOK_NUMBER}; "
        "no OpenAI call made, database untouched",
        flush=True,
    )
    return len(pairs)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    try:
        if args.dry_run:
            asyncio.run(_dry_run())
        else:
            asyncio.run(load())
    except EmbeddingClientError as error:
        print(f"[embeddings] {error}", file=sys.stderr, flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
