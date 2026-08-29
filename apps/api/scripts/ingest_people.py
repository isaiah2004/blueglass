"""Load the Lineage badge's data: people, parent/spouse edges, verse mentions.

Purpose
    The genealogy graph in the Lineage badge (``LineageBadgePayload`` in
    ``packages/shared/badges/literary-badge.types.ts``) needs a person's
    parents, partners, and every verse naming them. Theographic's People.csv
    is the only acquired dataset that publishes this as a graph rather than
    prose (``docs/architecture/dataset-validation.md`` section 3.4).

Decisions this command implements
    - ``Q-007`` -- Theographic is CC BY-SA 4.0. Its rows stay in their own
      tables, reachable by ``WHERE share_alike``, and are never blended into
      a record a bundled seed would distribute.
    - ``AI-05`` -- every row carries a ``source_id``, so the badge can name
      its source and licence and a row with no provenance cannot exist.
    - All 3,069 rows load regardless of Theographic's own ``status`` column
      (see ``theographic_people.py`` for why ``wip`` rows are not dropped).
    - Only ``parent-of`` and ``spouse-of`` edges are derived. Theographic's
      sibling columns are not loaded: ``LineageRelationKind`` has no sibling
      variant, and adding one is a product decision about what the badge
      draws, not a loader decision.

Usage
    docker compose exec api python -m scripts.ingest_people

Idempotence
    One transaction: this source's people, relations and mentions are deleted
    and rewritten. Re-running changes nothing but timestamps.
"""

from __future__ import annotations

import asyncio
import sys

import asyncpg

from app.config import get_settings
from scripts.data_source_registry import register_source
from scripts.person_assertions import assert_people_is_sound
from scripts.person_rows import PersonDataset
from scripts.raw_datasets import THEOGRAPHIC_PEOPLE
from scripts.theographic_people import read_people

_PEOPLE_COLUMNS = (
    "person_id",
    "name",
    "display_title",
    "gender",
    "occupations",
    "member_of",
    "dataset_status",
    "verse_count",
    "source_id",
)

_RELATION_COLUMNS = ("from_person_id", "to_person_id", "kind", "source_id")

_MENTION_COLUMNS = ("person_id", "verse_key", "osis_id", "source_id")


async def _write(connection: asyncpg.Connection, dataset: PersonDataset) -> int:
    """Everything this loader writes, proven before it commits. Returns source_id."""
    async with connection.transaction():
        source_id = await register_source(connection, THEOGRAPHIC_PEOPLE)

        # Children reference their parents, and spouse edges reference both
        # sides, so people must be written -- and safe to delete-then-rewrite
        # against -- before either edge or mention table touches them.
        await connection.execute("DELETE FROM person_mentions WHERE source_id = $1", source_id)
        await connection.execute("DELETE FROM person_relations WHERE source_id = $1", source_id)
        await connection.execute("DELETE FROM people WHERE source_id = $1", source_id)

        await connection.copy_records_to_table(
            "people",
            records=[
                (
                    person.person_id,
                    person.name,
                    person.display_title,
                    person.gender,
                    person.occupations,
                    person.member_of,
                    person.dataset_status,
                    person.verse_count,
                    source_id,
                )
                for person in dataset.people
            ],
            columns=list(_PEOPLE_COLUMNS),
        )
        await connection.copy_records_to_table(
            "person_relations",
            records=[
                (relation.from_person_id, relation.to_person_id, relation.kind, source_id)
                for relation in dataset.relations
            ],
            columns=list(_RELATION_COLUMNS),
        )
        await connection.copy_records_to_table(
            "person_mentions",
            records=[
                (mention.person_id, mention.verse_key, mention.osis_id, source_id)
                for mention in dataset.mentions
            ],
            columns=list(_MENTION_COLUMNS),
        )

        await assert_people_is_sound(
            connection, len(dataset.people), len(dataset.relations), len(dataset.mentions)
        )
    return source_id


async def load() -> int:
    """Load people, relations and mentions end to end. Returns the source_id."""
    dataset = read_people()
    print(
        f"[people] parsed {len(dataset.people)} people, {len(dataset.relations)} relations, "
        f"{len(dataset.mentions)} mentions",
        flush=True,
    )
    connection = await asyncpg.connect(dsn=get_settings().dsn)
    try:
        source_id = await _write(connection, dataset)
    finally:
        await connection.close()
    print(f"[people] committed under source_id={source_id}", flush=True)
    return source_id


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Takes no arguments: the whole dataset loads at once."""
    extra = sys.argv[1:] if argv is None else argv
    if extra:
        print(f"Unexpected arguments: {extra}", file=sys.stderr)
        return 2
    asyncio.run(load())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
