"""Load Hajime Murai's literary structure, and the pericopes it implies.

Purpose
    Two decisions land in one command. ``Q-009`` says passages are stored as
    rows, not derived at read time, and Murai's pericope list is the only open
    dataset that supplies canon-wide boundaries. ``Q-015`` says his chiastic
    analysis ships, attributed inline as "Murai's reading".

Licensing
    CC BY 4.0 for Murai's own labels, spans, titles and summaries. The verse
    quotations in the English column belong to the NAB, NRSV and NJB and are
    dropped at parse time by ``murai_copyright``; ``structure_assertions``
    proves in SQL that none survived. The Japanese column is never read.

    ``Q-015`` also says this must never be presented as settled fact, so the
    attribution is stored as data -- ``attributed_to``, ``claim_label`` and
    ``claim_type = 'interpretive'`` -- rather than left for a UI to remember.

Usage
    docker compose exec api python -m scripts.ingest_structure

Idempotence
    One transaction. Passages are upserted and then pruned to exactly the set
    the workbooks describe -- upserted rather than replaced so that
    ``passage_dating`` rows written by ``ingest_history`` survive a re-run.
    Structures and their nodes are deleted and rewritten wholesale.
"""

from __future__ import annotations

import asyncio
import sys

import asyncpg

from app.config import get_settings
from scripts.data_source_registry import register_source
from scripts.murai_parser import read_pericopes, read_structures
from scripts.murai_records import SCHEME, ParseTally, Pericope, StructureUnit
from scripts.raw_datasets import MURAI_STRUCTURE
from scripts.structure_assertions import assert_structure_is_sound

#: Q-015 in two strings. Stored per row, not per source, because a second
#: scholar's reading of the same passage would need its own framing.
ATTRIBUTED_TO = "Hajime Murai"
CLAIM_LABEL = "Murai's reading"
CLAIM_TYPE = "interpretive"

_UPSERT_PASSAGE = """
    INSERT INTO passages
        (passage_id, book_number, chapter, start_key, end_key, title, scheme)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (passage_id) DO UPDATE SET
        book_number = excluded.book_number, chapter = excluded.chapter,
        start_key = excluded.start_key, end_key = excluded.end_key,
        title = coalesce(excluded.title, passages.title),
        scheme = excluded.scheme
"""

_PRUNE_PASSAGES = """
    DELETE FROM passages
    WHERE scheme = $1 AND passage_id <> ALL($2::varchar[])
"""

_DELETE_STRUCTURES = "DELETE FROM literary_structures WHERE source_id = $1"

_INSERT_STRUCTURE = """
    INSERT INTO literary_structures
        (passage_id, pattern, centre_label, legend,
         attributed_to, claim_label, claim_type, source_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
"""

_NODE_COLUMNS = (
    "structure_id",
    "node_index",
    "label",
    "pair_label",
    "is_centre",
    "start_key",
    "end_key",
    "summary",
    "catchword",
)


def _passage_rows(
    pericopes: list[Pericope], units: list[StructureUnit]
) -> list[tuple[str, int, int, int, int, str | None, str]]:
    """Every passage the workbooks describe, titled where a title exists.

    The structure workbook occasionally analyses a range the pericope list does
    not carry -- 46 of 1,830. Those still need a passage row, or their
    structure has nothing to hang off; they simply have no title.
    """
    rows: dict[str, tuple[str, int, int, int, int, str | None, str]] = {}
    for unit in units:
        chapter = (unit.span.start_key // 1_000) % 1_000
        rows[unit.passage_id] = (
            unit.passage_id,
            unit.book_number,
            chapter,
            unit.span.start_key,
            unit.span.end_key,
            None,
            SCHEME,
        )
    for pericope in pericopes:
        rows[pericope.passage_id] = (
            pericope.passage_id,
            pericope.book_number,
            pericope.chapter,
            pericope.start_key,
            pericope.end_key,
            pericope.title or None,
            SCHEME,
        )
    return list(rows.values())


async def _write_passages(
    connection: asyncpg.Connection, rows: list[tuple[str, int, int, int, int, str | None, str]]
) -> None:
    """Upsert every passage, then remove any this scheme no longer claims."""
    await connection.executemany(_UPSERT_PASSAGE, rows)
    await connection.execute(_PRUNE_PASSAGES, SCHEME, [row[0] for row in rows])


async def _write_structures(
    connection: asyncpg.Connection, units: list[StructureUnit], source_id: int
) -> None:
    """Replace this source's structures and their nodes."""
    await connection.execute(_DELETE_STRUCTURES, source_id)
    await connection.executemany(
        _INSERT_STRUCTURE,
        [
            (
                unit.passage_id,
                unit.pattern,
                unit.centre_label,
                unit.legend,
                ATTRIBUTED_TO,
                CLAIM_LABEL,
                CLAIM_TYPE,
                source_id,
            )
            for unit in units
        ],
    )
    identifiers = {
        record["passage_id"]: record["id"]
        for record in await connection.fetch(
            "SELECT id, passage_id FROM literary_structures WHERE source_id = $1",
            source_id,
        )
    }
    await connection.copy_records_to_table(
        "structure_nodes",
        records=[
            (
                identifiers[unit.passage_id],
                node.node_index,
                node.label,
                node.pair_label,
                node.is_centre,
                node.start_key,
                node.end_key,
                node.summary,
                node.catchword,
            )
            for unit in units
            for node in unit.nodes
        ],
        columns=list(_NODE_COLUMNS),
    )


async def _write(
    connection: asyncpg.Connection,
    pericopes: list[Pericope],
    units: list[StructureUnit],
    tally: ParseTally,
) -> None:
    """Everything this loader writes, proven before it commits."""
    async with connection.transaction():
        source_id = await register_source(connection, MURAI_STRUCTURE)
        await _write_passages(connection, _passage_rows(pericopes, units))
        await _write_structures(connection, units, source_id)
        await assert_structure_is_sound(connection, source_id, pericopes, units, tally)


def _report(pericopes: list[Pericope], units: list[StructureUnit], tally: ParseTally) -> None:
    """Print what was actually parsed, never what was expected."""
    nodes = sum(len(unit.nodes) for unit in units)
    print(
        f"[structure] parsed {len(pericopes)} pericopes, {len(units)} structures, "
        f"{nodes} nodes",
        flush=True,
    )
    print(
        f"[structure] skipped {tally.orphan_nodes} nodes under an unnumbered header, "
        f"{tally.unstructured_units} pericopes Murai left unstructured, "
        f"{tally.skipped_rows} other rows; repaired {tally.repaired_labels} labels",
        flush=True,
    )
    print(
        f"[structure] English glosses kept {tally.glosses_kept}, "
        f"dropped {tally.glosses_dropped} as quoted scripture",
        flush=True,
    )


async def load() -> int:
    """Load the whole corpus. Returns the number of structures committed."""
    pericopes = read_pericopes()
    units, tally = read_structures()
    _report(pericopes, units, tally)
    connection = await asyncpg.connect(dsn=get_settings().dsn)
    try:
        await _write(connection, pericopes, units, tally)
    finally:
        await connection.close()
    print(f"[structure] {len(units)} structures committed", flush=True)
    return len(units)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Takes no arguments: the corpus is loaded whole."""
    extra = sys.argv[1:] if argv is None else argv
    if extra:
        print(f"Unexpected arguments: {extra}", file=sys.stderr)
        return 2
    asyncio.run(load())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
