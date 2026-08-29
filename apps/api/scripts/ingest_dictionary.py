"""Load the Cultural badge's citation table: NEUU dictionary entries and refs.

Purpose
    Gives the Cultural badge's future authored prose (M7, Q-024) something
    deterministic to quote and cite: an Easton or Smith headword and every
    verse it names. See ``scripts/neuu_dictionary.py`` for why this pair over
    unfoldingWord's ``en_tn``, and ``dictionary_rows.py``/the migration for
    exactly what is and is not modelled as a citation.

Decisions this command implements
    - ``AI-05`` -- every row carries a ``source_id``.
    - This is NOT the Cultural badge's ``explanation`` prose. That is
      authored, not loaded; this command only builds what the author quotes.

Usage
    docker compose exec api python -m scripts.ingest_dictionary

Idempotence
    One transaction: this source's entries and citations are deleted and
    rewritten. Re-running changes nothing but timestamps.
"""

from __future__ import annotations

import asyncio
import sys

import asyncpg

from app.config import get_settings
from scripts.data_source_registry import register_source
from scripts.dictionary_assertions import assert_dictionary_is_sound
from scripts.dictionary_rows import DictionaryDataset
from scripts.neuu_dictionary import read_dictionary
from scripts.raw_datasets import NEUU_BIBLE_DICTIONARY

_ENTRY_COLUMNS = (
    "entry_id",
    "source",
    "source_name",
    "headword",
    "display_name",
    "slug",
    "definition_text",
    "source_id",
)

_CITATION_COLUMNS = ("entry_id", "start_key", "end_key", "raw_reference", "source_id")


async def _write(connection: asyncpg.Connection, dataset: DictionaryDataset) -> int:
    """Everything this loader writes, proven before it commits. Returns source_id."""
    async with connection.transaction():
        source_id = await register_source(connection, NEUU_BIBLE_DICTIONARY)

        await connection.execute(
            "DELETE FROM dictionary_citations WHERE source_id = $1", source_id
        )
        await connection.execute("DELETE FROM dictionary_entries WHERE source_id = $1", source_id)

        await connection.copy_records_to_table(
            "dictionary_entries",
            records=[
                (
                    entry.entry_id,
                    entry.source,
                    entry.source_name,
                    entry.headword,
                    entry.display_name,
                    entry.slug,
                    entry.definition_text,
                    source_id,
                )
                for entry in dataset.entries
            ],
            columns=list(_ENTRY_COLUMNS),
        )
        await connection.copy_records_to_table(
            "dictionary_citations",
            records=[
                (citation.entry_id, citation.start_key, citation.end_key, citation.raw_reference,
                 source_id)
                for citation in dataset.citations
            ],
            columns=list(_CITATION_COLUMNS),
        )

        await assert_dictionary_is_sound(
            connection, len(dataset.entries), len(dataset.citations)
        )
    return source_id


async def load() -> int:
    """Load entries and citations end to end. Returns the source_id."""
    dataset = read_dictionary()
    print(
        f"[dictionary] parsed {len(dataset.entries)} entries, {len(dataset.citations)} "
        f"citations, {dataset.unresolved_reference_count} references not modelled "
        "(whole-chapter or cross-chapter -- see scripts/neuu_dictionary.py)",
        flush=True,
    )
    connection = await asyncpg.connect(dsn=get_settings().dsn)
    try:
        source_id = await _write(connection, dataset)
    finally:
        await connection.close()
    print(f"[dictionary] committed under source_id={source_id}", flush=True)
    return source_id


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Takes no arguments: both dictionaries load at once."""
    extra = sys.argv[1:] if argv is None else argv
    if extra:
        print(f"Unexpected arguments: {extra}", file=sys.stderr)
        return 2
    asyncio.run(load())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
