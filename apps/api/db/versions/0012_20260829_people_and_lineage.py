"""People, genealogy edges and verse mentions for the Lineage badge.

Purpose
    ``LineageBadgePayload`` (``packages/shared/badges/literary-badge.types.
    ts``) needs a person, their parents and partners, and every verse naming
    them. Theographic's People.csv is the only acquired dataset that
    publishes parent/child/spouse edges as a graph (see
    ``scripts/theographic_people.py`` for the full sourcing rationale).

Shape decisions
    - ``people.person_id`` is Theographic's own ``personLookup`` (e.g.
      ``paul_2479``), not a surrogate -- the same reasoning as
      ``places.place_id`` in 0005: a natural key is what makes a re-ingest by
      ``source_id`` idempotent without renumbering every relation row.
    - ``person_relations.kind`` is constrained to the two edges this loader
      derives. Theographic also publishes siblings, but
      ``LineageRelationKind`` has no sibling variant yet; the CHECK exists so
      a future loader bug cannot write an edge kind nothing downstream reads,
      the same discipline Q-016 applies to book_number in passage_dating.
    - ``person_mentions`` carries its own ``source_id`` (unlike
      ``place_mentions`` in 0005, which has none): Theographic and any future
      NEUU/Cultural-derived mention table both cite verses, and a shared
      table with no source column could not tell which loader wrote a row it
      needed to delete-and-rewrite.

ON Q-007 (share-alike)
    Every table here carries ``source_id`` referencing Theographic's CC BY-SA
    4.0 ``data_sources`` row, exactly like ``historical_events`` in 0001/0011.
    None of these rows may be blended into a bundled or redistributed record.

Revision ID: 0012_people_lineage
Revises: 0011_ruler_realm
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0012_people_lineage"
down_revision = "0011_ruler_realm"
branch_labels = None
depends_on = None

#: The only two edge kinds this loader derives. See ``scripts.person_rows``.
_RELATION_KINDS = ("parent-of", "spouse-of")


def upgrade() -> None:
    _create_people()
    _create_person_relations()
    _create_person_mentions()


def _create_people() -> None:
    """One row per person Theographic names, ``wip`` status included."""
    op.execute(
        """
        CREATE TABLE people (
            person_id      varchar(32) PRIMARY KEY,
            name           text NOT NULL,
            display_title  text NOT NULL,
            gender         varchar(8) NOT NULL CHECK (gender IN ('Male', 'Female')),
            occupations    text,
            member_of      text,
            dataset_status varchar(16) NOT NULL,
            verse_count    int NOT NULL DEFAULT 0,
            source_id      int NOT NULL REFERENCES data_sources(id)
        )
        """
    )
    op.execute("CREATE INDEX people_name_idx ON people USING gin (name gin_trgm_ops)")


def _create_person_relations() -> None:
    """Parent-of and spouse-of edges over the people table."""
    op.execute(
        f"""
        CREATE TABLE person_relations (
            from_person_id varchar(32) NOT NULL
                                REFERENCES people(person_id) ON DELETE CASCADE,
            to_person_id   varchar(32) NOT NULL
                                REFERENCES people(person_id) ON DELETE CASCADE,
            kind           varchar(16) NOT NULL CHECK (kind IN {_RELATION_KINDS!r}),
            source_id      int NOT NULL REFERENCES data_sources(id),
            PRIMARY KEY (from_person_id, to_person_id, kind)
        )
        """
    )
    op.execute("CREATE INDEX person_relations_to_idx ON person_relations (to_person_id)")


def _create_person_mentions() -> None:
    """Which people are named in a verse -- what the badge iterates over."""
    op.execute(
        """
        CREATE TABLE person_mentions (
            person_id  varchar(32) NOT NULL
                           REFERENCES people(person_id) ON DELETE CASCADE,
            verse_key  int NOT NULL,
            osis_id    varchar(32) NOT NULL,
            source_id  int NOT NULL REFERENCES data_sources(id),
            PRIMARY KEY (person_id, verse_key, source_id)
        )
        """
    )
    op.execute("CREATE INDEX person_mentions_verse_idx ON person_mentions (verse_key)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS person_mentions")
    op.execute("DROP TABLE IF EXISTS person_relations")
    op.execute("DROP TABLE IF EXISTS people")
