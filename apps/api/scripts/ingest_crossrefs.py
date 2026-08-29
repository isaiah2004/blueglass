"""Load OpenBible.info's cross-references, the Cross-Ref badge's whole dataset.

Purpose
    344,799 community-voted references, CC BY 4.0, asserted in the data file's
    own header row. This is the richest deterministic dataset the project has
    and it lights a badge with no content risk: every row is a scripture
    reference, so there is nothing to hallucinate and nothing to review.

Licensing
    The licence and the exact attribution string live in ``data_sources`` and
    every row carries ``source_id``, so the UI reads its attribution from the
    database. AI-05: a badge that cannot name its source must not render.

Usage
    docker compose run --rm api python -m scripts.ingest_crossrefs
    docker compose run --rm api python -m scripts.ingest_crossrefs --dry-run

Idempotence
    One transaction: upsert the source, delete this source's rows, COPY them
    back, assert the result, commit. Re-running changes nothing but
    ``loaded_at``, and a failed assertion rolls the whole thing back rather
    than leaving a partial index behind.

Verification
    Three gates before commit -- the payload's SHA-256 matches the digest
    recorded at acquisition, the parsed row count matches the measured
    expectation, and every check in ``crossref_assertions`` passes against the
    real table.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

import asyncpg

from app.config import get_settings
from scripts.crossref_assertions import EXPECTED_ROWS, assert_cross_references_are_sound
from scripts.crossref_rows import CrossReferenceRow, archive_text, parse_cross_references
from scripts.openbible_sources import (
    CROSS_REFERENCE_ARCHIVE,
    CROSS_REFERENCES,
    RawDataError,
    read_bytes,
    upsert_source,
)

_COPY_COLUMNS = ("from_key", "to_start_key", "to_end_key", "votes", "source_id")


def read_rows() -> list[CrossReferenceRow]:
    """Verify the archive, parse it, and check the count before any SQL runs.

    Failing here costs nothing. Failing after the DELETE costs a rollback and,
    if the assertion had been left out as it was in the prototype, would have
    cost a half-loaded table nobody could distinguish from a whole one.
    """
    rows = parse_cross_references(archive_text(read_bytes(CROSS_REFERENCE_ARCHIVE)))
    if len(rows) != EXPECTED_ROWS:
        raise RawDataError(
            f"Parsed {len(rows)} cross-references, expected {EXPECTED_ROWS}. "
            "The upstream file has changed shape; re-measure before loading."
        )
    return rows


async def _write(connection: asyncpg.Connection, rows: list[CrossReferenceRow]) -> None:
    """Replace this source's cross-references and prove the result, atomically."""
    async with connection.transaction():
        source_id = await upsert_source(connection, CROSS_REFERENCES)
        await connection.execute(
            "DELETE FROM cross_references WHERE source_id = $1", source_id
        )
        await connection.copy_records_to_table(
            "cross_references",
            records=[
                (row.from_key, row.to_start_key, row.to_end_key, row.votes, source_id)
                for row in rows
            ],
            columns=list(_COPY_COLUMNS),
        )
        await assert_cross_references_are_sound(connection, source_id)


async def load() -> int:
    """Load the cross-references end to end. Returns the committed row count."""
    print("[xref] verifying and parsing the acquired archive", flush=True)
    rows = read_rows()
    connection = await asyncpg.connect(dsn=get_settings().dsn)
    try:
        await _write(connection, rows)
    finally:
        await connection.close()
    print(f"[xref] {len(rows)} cross-references committed", flush=True)
    return len(rows)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load OpenBible.info cross-references (CC BY 4.0)."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="verify and parse the archive without touching the database",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    if args.dry_run:
        print(f"[xref] {len(read_rows())} rows parsed; database untouched", flush=True)
        return 0
    asyncio.run(load())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
