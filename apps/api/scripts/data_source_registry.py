"""Write a dataset's provenance row and hand back its id.

Purpose
    ``AI-05`` says a badge with no provenance must not render. The only way to
    make that true rather than aspirational is for the attribution to live on
    the row the badge is built from, so every enrichment loader calls this
    first and stores the returned ``source_id`` on everything it writes.

Key responsibilities
    Upsert one ``data_sources`` row from a ``RawDataset``, idempotently.

Dependencies
    asyncpg and ``raw_datasets``. No application code.

Usage
    source_id = await register_source(connection, MURAI_STRUCTURE)
"""

from __future__ import annotations

import asyncpg

from scripts.raw_datasets import RawDataset

_UPSERT = """
    INSERT INTO data_sources
        (key, name, url, license, share_alike, attribution, version, loaded_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, now())
    ON CONFLICT (key) DO UPDATE SET
        name = excluded.name, url = excluded.url, license = excluded.license,
        share_alike = excluded.share_alike, attribution = excluded.attribution,
        version = excluded.version, loaded_at = excluded.loaded_at
    RETURNING id
"""


async def register_source(connection: asyncpg.Connection, dataset: RawDataset) -> int:
    """Record where this data came from, and return the id rows must carry.

    Upsert rather than insert: re-running a loader must not create a second
    provenance row, or half the enrichment would point at a stale licence.
    """
    source_id = await connection.fetchval(
        _UPSERT,
        dataset.key,
        dataset.name,
        dataset.url,
        dataset.licence.identifier,
        dataset.licence.share_alike,
        dataset.licence.attribution,
        dataset.version,
    )
    if source_id is None:
        raise RuntimeError(f"data_sources upsert returned no id for {dataset.key}.")
    return int(source_id)
