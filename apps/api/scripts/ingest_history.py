"""Load the History badge's data: rulers, dated events, and passage dating.

Purpose
    The dual-axis timeline in docs/product/mockups/image5.png needs three
    things: who was in power, what happened, and when the passage in front of
    the reader sits. All three are deterministic joins over two acquired files.
    No model is involved and no money is spent.

Decisions this command implements
    - ``Q-016`` -- dating is NEW TESTAMENT ONLY. The only open per-passage
      dating descends from Ussher's chronology, which for the Old Testament
      encodes a position mainstream scholarship rejects. The parser filters,
      and the schema's CHECK constraints make the filter unbypassable.
    - ``AI-05`` -- every row carries a ``source_id``, so the badge can name its
      source and licence and a row with no provenance cannot exist.
    - ``Q-007`` -- Theographic is CC BY-SA 4.0 and stays in its own tables,
      reachable by ``WHERE share_alike``. Wikidata's rulers are CC0.

Order
    Run ``scripts.ingest_structure`` first. Passage dating joins events against
    the passages that ingest loads; with no passages the command refuses to run
    rather than committing an empty timeline.

Usage
    docker compose exec api python -m scripts.ingest_history

Idempotence
    One transaction: each source's rows are deleted and rewritten, and passage
    dating is rebuilt from scratch. Re-running changes nothing but timestamps.
"""

from __future__ import annotations

import asyncio
import sys

import asyncpg

from app.config import get_settings
from scripts.data_source_registry import register_source
from scripts.history_assertions import assert_history_is_sound
from scripts.raw_datasets import THEOGRAPHIC_EVENTS, WIKIDATA_RULERS
from scripts.theographic_events import EventRow, read_new_testament_events
from scripts.wikidata_rulers import RulerRow, read_rulers

_RULER_COLUMNS = (
    "external_id",
    "name",
    "realm",
    "title",
    "start_year",
    "end_year",
    "start_date",
    "end_date",
    "date_precision",
    "source_id",
)

_EVENT_COLUMNS = (
    "external_id",
    "title",
    "year_approx",
    "date_label",
    "book_number",
    "start_key",
    "end_key",
    "part_of",
    "source_id",
)

_COUNT_NT_PASSAGES = "SELECT count(*) FROM passages WHERE book_number BETWEEN 40 AND 66"

#: One dating row per passage: the most SPECIFIC overlapping event, not the
#: one that covers the most verses. Theographic carries 32 umbrella events --
#: "Second Missionary Journey" spans Acts 15-18 -- and ranking by raw overlap
#: hands every passage in Acts 15-18 the umbrella's AD 46 instead of the AD 47
#: of the episode actually on the page. Ranking by the fraction of the EVENT
#: that lies inside the passage puts the tight episode first and keeps the
#: umbrella as the fallback when nothing tighter exists.
#:
#: Widths are counted as REAL VERSES against the loaded scripture, not as
#: differences between verse keys. Key arithmetic is only valid inside one
#: chapter: Acts 3:1-4:4 is 30 verses but 1,004 keys apart, so a key-based
#: percentage told the reader an event covered 2% of a passage it covers
#: entirely. $1 is the reference translation.
_BUILD_PASSAGE_DATING = """
    WITH event_overlap AS (
        SELECT p.passage_id,
               p.book_number,
               e.id           AS event_id,
               e.year_approx,
               e.date_label,
               e.title,
               e.source_id,
               (SELECT count(*) FROM verses v
                 WHERE v.translation = $1
                   AND v.verse_key BETWEEN GREATEST(p.start_key, e.start_key)
                                       AND LEAST(p.end_key, e.end_key))  AS covered,
               (SELECT count(*) FROM verses v
                 WHERE v.translation = $1
                   AND v.verse_key BETWEEN p.start_key AND p.end_key)    AS width,
               (SELECT count(*) FROM verses v
                 WHERE v.translation = $1
                   AND v.verse_key BETWEEN e.start_key AND e.end_key)    AS event_width
        FROM passages p
        JOIN historical_events e
          ON e.book_number = p.book_number
         AND int4range(e.start_key, e.end_key, '[]')
             && int4range(p.start_key, p.end_key, '[]')
        WHERE p.book_number BETWEEN 40 AND 66
    )
    INSERT INTO passage_dating
        (passage_id, book_number, year_approx, year_label, confidence,
         origin, rationale, event_id, source_id)
    SELECT DISTINCT ON (passage_id)
           passage_id,
           book_number,
           year_approx,
           date_label,
           LEAST(1.0, covered::real / NULLIF(width, 0))::real,
           'sourced',
           format(
               'Dated from the Theographic event %s (%s), which narrates about'
               ' %s%% of this passage.',
               title, date_label,
               round(100.0 * LEAST(covered, width) / NULLIF(width, 0))
           ),
           event_id,
           source_id
    FROM event_overlap
    WHERE width > 0 AND event_width > 0
    ORDER BY passage_id,
             covered::real / event_width DESC,
             covered DESC,
             year_approx,
             event_id
"""

#: KJV first because verse_key is KJV versification; otherwise whichever
#: translation has the most verses. A database with no scripture cannot
#: measure coverage, and guessing would be worse than stopping.
_REFERENCE_TRANSLATION = """
    SELECT translation FROM verses
    GROUP BY translation
    ORDER BY (translation = 'KJV') DESC, count(*) DESC
    LIMIT 1
"""


async def _write_rulers(
    connection: asyncpg.Connection, rulers: list[RulerRow], source_id: int
) -> None:
    """Replace the ruler table for this source."""
    await connection.execute("DELETE FROM rulers WHERE source_id = $1", source_id)
    await connection.copy_records_to_table(
        "rulers",
        records=[
            (
                ruler.external_id,
                ruler.name,
                ruler.realm,
                ruler.title,
                ruler.start_year,
                ruler.end_year,
                ruler.start_date,
                ruler.end_date,
                ruler.date_precision,
                source_id,
            )
            for ruler in rulers
        ],
        columns=list(_RULER_COLUMNS),
    )


async def _write_events(
    connection: asyncpg.Connection, events: list[EventRow], source_id: int
) -> None:
    """Replace the event table for this source."""
    await connection.execute("DELETE FROM historical_events WHERE source_id = $1", source_id)
    await connection.copy_records_to_table(
        "historical_events",
        records=[
            (
                event.external_id,
                event.title,
                event.year_approx,
                event.date_label,
                event.book_number,
                event.start_key,
                event.end_key,
                event.part_of,
                source_id,
            )
            for event in events
        ],
        columns=list(_EVENT_COLUMNS),
    )


async def _build_dating(connection: asyncpg.Connection) -> int:
    """Rebuild passage dating from the events just written. Returns the count."""
    passages = await connection.fetchval(_COUNT_NT_PASSAGES)
    if not passages:
        raise RuntimeError(
            "No New Testament passages are loaded, so there is nothing to date. "
            "Run `python -m scripts.ingest_structure` first."
        )
    reference = await connection.fetchval(_REFERENCE_TRANSLATION)
    if reference is None:
        raise RuntimeError(
            "No scripture is loaded, so passage coverage cannot be measured. "
            "Run `python -m scripts.load_scripture --all` first."
        )
    await connection.execute("DELETE FROM passage_dating")
    await connection.execute(_BUILD_PASSAGE_DATING, reference)
    return await connection.fetchval("SELECT count(*) FROM passage_dating")


async def _write(
    connection: asyncpg.Connection, rulers: list[RulerRow], events: list[EventRow]
) -> int:
    """Everything this loader writes, proven before it commits."""
    async with connection.transaction():
        ruler_source = await register_source(connection, WIKIDATA_RULERS)
        event_source = await register_source(connection, THEOGRAPHIC_EVENTS)
        await _write_rulers(connection, rulers, ruler_source)
        await _write_events(connection, events, event_source)
        dated = await _build_dating(connection)
        await assert_history_is_sound(connection, len(rulers), len(events))
    return dated


async def load() -> int:
    """Load rulers, events and dating end to end. Returns the dated count."""
    rulers = read_rulers()
    events = read_new_testament_events()
    realms = sorted({ruler.realm or "(no realm in source)" for ruler in rulers})
    print(
        f"[history] parsed {len(rulers)} rulers across {realms}, "
        f"{len(events)} event rows over {len({e.external_id for e in events})} events",
        flush=True,
    )
    connection = await asyncpg.connect(dsn=get_settings().dsn)
    try:
        dated = await _write(connection, rulers, events)
    finally:
        await connection.close()
    print(f"[history] {dated} passages dated, New Testament only (Q-016)", flush=True)
    return dated


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Takes no arguments: the whole era loads at once."""
    extra = sys.argv[1:] if argv is None else argv
    if extra:
        print(f"Unexpected arguments: {extra}", file=sys.stderr)
        return 2
    asyncio.run(load())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
