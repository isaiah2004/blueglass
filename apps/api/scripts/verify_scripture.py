"""Report what is actually in the database, and fail if it is not what we claim.

Purpose
    The load-time checks run inside the loading transaction, which proves the
    load was sound at the moment it happened. This script proves it is still
    sound now, from a fresh connection, reading only committed data. It is what
    a report of "row counts per translation" should be based on -- measured, not
    expected.

    It also names translations present in the database but absent from the
    catalogue, because a leftover from an earlier schema is exactly the kind of
    thing that quietly serves a reader stale or unlicensed text.

Usage
    docker compose run --rm api python -m scripts.verify_scripture

Exit codes
    0  every catalogued translation is loaded and passes every check
    1  something is missing, short, or unaccounted for
"""

from __future__ import annotations

import asyncio
import sys

import asyncpg

from app.config import get_settings
from scripts.scripture_assertions import IntegrityFailure, assert_translation_is_sound
from scripts.translation_catalogue import CATALOGUE

_SUMMARY = """
    SELECT v.translation,
           count(*)                        AS verses,
           count(DISTINCT v.book_number)   AS books,
           coalesce(s.license, '-')        AS license,
           coalesce(s.attribution, '')     AS attribution
    FROM verses v
    LEFT JOIN translations t ON t.code = v.translation
    LEFT JOIN data_sources s ON s.id = t.source_id
    GROUP BY v.translation, s.license, s.attribution
    ORDER BY v.translation
"""


def _format_row(record: asyncpg.Record) -> str:
    """One line of the report."""
    attribution = record["attribution"]
    shown = attribution[:48] + "..." if len(attribution) > 51 else attribution
    return (
        f"  {record['translation']:<8} {record['verses']:>7} verses  "
        f"{record['books']:>2} books  {record['license']:<16} {shown}"
    )


async def _report(connection: asyncpg.Connection) -> list[str]:
    """Print the measured summary and return the problems found."""
    rows = await connection.fetch(_SUMMARY)
    loaded = {record["translation"]: record for record in rows}
    print("[verify] measured row counts")
    for record in rows:
        print(_format_row(record))
    problems: list[str] = []
    for code, source in CATALOGUE.items():
        if code not in loaded:
            problems.append(f"{code} is catalogued but has no verses loaded")
            continue
        try:
            await assert_translation_is_sound(connection, source)
        except IntegrityFailure as failure:
            problems.append(str(failure))
    for code in loaded:
        if code not in CATALOGUE:
            problems.append(
                f"{code} has verses but is not in the catalogue -- unlicensed or "
                "stale data may be reachable through the switcher"
            )
    return problems


async def verify() -> int:
    """Connect, report, and return an exit code."""
    connection = await asyncpg.connect(dsn=get_settings().dsn)
    try:
        problems = await _report(connection)
    finally:
        await connection.close()
    if problems:
        print("[verify] FAILED", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1
    total = len(CATALOGUE)
    print(f"[verify] OK: {total} translations loaded and sound")
    return 0


def main() -> int:
    """CLI entry point."""
    return asyncio.run(verify())


if __name__ == "__main__":
    raise SystemExit(main())
