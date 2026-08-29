"""Load a public-domain translation into the verses table.

Purpose
    M1 needs REAL scripture on screen. This is the one command that puts it in
    the database. It is a developer tool, not part of the service: nothing under
    app/ imports it.

Licensing
    Only translations that are public domain are catalogued, each verified
    against the publisher's own statement (scripts/translation_licences.py).
    Licence and attribution are written to data_sources and linked from
    translations.source_id, so the reader can render an attribution from the
    database rather than from a file nobody deployed. ESV appears in the product
    mockups and is LICENSED -- it must never be loaded here or shipped.

Usage
    docker compose run --rm api python -m scripts.load_scripture BSB
    docker compose run --rm api python -m scripts.load_scripture --all

Idempotence
    Each translation is replaced inside one transaction: delete its rows, COPY
    them back, check the result, commit. Re-running changes nothing but the
    loaded_at timestamp, and a failed check rolls the whole thing back rather
    than leaving a partial Bible behind.

Verification
    Three gates, all of which must pass before the transaction commits:
      1. the cached payload's SHA-256 matches data/scripture/manifest.json;
      2. the parsed row count matches the catalogue's measured verse count;
      3. the committed table passes every check in scripture_assertions.py.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

import asyncpg

from app.config import get_settings
from scripts.parse_translation import parse_and_verify
from scripts.scripture_assertions import assert_translation_is_sound
from scripts.source_files import read_payload
from scripts.translation_catalogue import CATALOGUE, TranslationSource, require_source
from scripts.verse_rows import VerseRow

_UPSERT_SOURCE = """
    INSERT INTO data_sources
        (key, name, url, license, share_alike, attribution, version, loaded_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, now())
    ON CONFLICT (key) DO UPDATE SET
        name = excluded.name, url = excluded.url, license = excluded.license,
        share_alike = excluded.share_alike, attribution = excluded.attribution,
        version = excluded.version, loaded_at = excluded.loaded_at
    RETURNING id
"""

_UPSERT_TRANSLATION = """
    INSERT INTO translations (code, name, language, source_id, can_redistribute)
    VALUES ($1, $2, $3, $4, true)
    ON CONFLICT (code) DO UPDATE SET
        name = excluded.name, language = excluded.language,
        source_id = excluded.source_id,
        can_redistribute = excluded.can_redistribute
"""

_COPY_COLUMNS = (
    "verse_key",
    "translation",
    "book_number",
    "chapter",
    "verse",
    "osis_id",
    "text",
)


async def _record_provenance(
    connection: asyncpg.Connection, source: TranslationSource
) -> None:
    """Write the licence, then point the translation row at it.

    Every translation gets its OWN data_sources row. Sharing one per publisher
    would force one attribution string onto texts with different obligations --
    the WEB's trademark notice is not the KJV's letters-patent caveat.
    """
    source_id = await connection.fetchval(
        _UPSERT_SOURCE,
        source.source_key,
        source.name,
        source.licence.url,
        source.licence.identifier,
        source.licence.share_alike,
        source.licence.attribution,
        source.version,
    )
    await connection.execute(
        _UPSERT_TRANSLATION, source.code, source.name, source.language, source_id
    )


async def _write(
    connection: asyncpg.Connection, source: TranslationSource, rows: list[VerseRow]
) -> None:
    """Replace this translation's verses and prove the result, in one transaction."""
    async with connection.transaction():
        await _record_provenance(connection, source)
        await connection.execute("DELETE FROM verses WHERE translation = $1", source.code)
        await connection.copy_records_to_table(
            "verses",
            records=[
                (
                    row.verse_key,
                    row.translation,
                    row.book_number,
                    row.chapter,
                    row.verse,
                    row.osis_id,
                    row.text,
                )
                for row in rows
            ],
            columns=list(_COPY_COLUMNS),
        )
        await assert_translation_is_sound(connection, source)


async def load(code: str) -> int:
    """Load one translation end to end. Returns the committed verse count."""
    source = require_source(code)
    print(f"[load] {source.code}: reading cached payload", flush=True)
    rows = parse_and_verify(source, read_payload(source))
    connection = await asyncpg.connect(dsn=get_settings().dsn)
    try:
        await _write(connection, source, rows)
    finally:
        await connection.close()
    print(f"[load] {source.code}: {len(rows)} verses committed", flush=True)
    return len(rows)


async def load_all(codes: list[str]) -> None:
    """Load several translations over one process lifetime."""
    for code in codes:
        await load(code)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load public-domain scripture.")
    parser.add_argument("codes", nargs="*", help=f"one of: {', '.join(CATALOGUE)}")
    parser.add_argument("--all", action="store_true", help="load every catalogue entry")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    codes = list(CATALOGUE) if args.all else args.codes
    if not codes:
        print("Nothing to do: pass a translation code or --all.", file=sys.stderr)
        return 2
    for code in codes:
        require_source(code)
    asyncio.run(load_all(codes))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
