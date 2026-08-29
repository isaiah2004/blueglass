"""Write each row-set's source, licence and retrieval date into the database.

Purpose
    AI-05 requires every badge to name where its content came from, and the UI
    reads that from the database rather than from a PROVENANCE.md that never
    ships. This is the one place lexicon provenance rows are written.

Key responsibilities
    Upsert a `data_sources` row per source and hand back its id, so every
    lexeme, word and alignment row can point at one.

Dependencies
    asyncpg, and the source table in `sources.py`.

Usage
    ids = await upsert_sources(connection, ALL_SOURCES)
"""

from __future__ import annotations

from collections.abc import Iterable

import asyncpg

from .sources import LexiconSource

_UPSERT = """
    INSERT INTO data_sources
        (key, name, url, license, share_alike, attribution, version,
         retrieved_at, loaded_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
    ON CONFLICT (key) DO UPDATE SET
        name = excluded.name, url = excluded.url, license = excluded.license,
        share_alike = excluded.share_alike, attribution = excluded.attribution,
        version = excluded.version, retrieved_at = excluded.retrieved_at,
        loaded_at = excluded.loaded_at
    RETURNING id
"""


async def upsert_sources(
    connection: asyncpg.Connection, sources: Iterable[LexiconSource]
) -> dict[str, int]:
    """Record every source and return its database id, keyed by source key."""
    ids: dict[str, int] = {}
    for source in sources:
        source_id = await connection.fetchval(
            _UPSERT,
            source.key,
            source.name,
            source.url,
            source.licence,
            source.share_alike,
            source.attribution,
            source.version,
            source.retrieved_at,
        )
        if source_id is None:  # pragma: no cover - RETURNING always yields a row
            raise RuntimeError(f"data_sources upsert returned no id for {source.key}")
        ids[source.key] = int(source_id)
    return ids
