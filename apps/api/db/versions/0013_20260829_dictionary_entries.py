"""Dictionary entries and their verse citations for the Cultural badge.

Purpose
    ``CulturalBadgePayload`` (``packages/shared/badges/historical-badge.
    types.ts``) needs authored prose (``custom``, ``world``, ``explanation``),
    which no dataset supplies mechanically -- that is M7, Q-024 work. What a
    loader CAN supply deterministically is what that prose gets to quote and
    cite: a headword's definition and the verses it names. This is that
    table, built from NEUU's Easton + Smith JSON (see
    ``scripts/neuu_dictionary.py`` for the full sourcing rationale, and
    ``docs/architecture/dataset-validation.md`` section 3.5 "Option D" for
    why this pair over unfoldingWord's ``en_tn``).

Shape decisions
    - ``dictionary_entries.entry_id`` is ``"<source>:<headword>"`` (e.g.
      ``"EAS:PAUL"``), not a surrogate -- the same natural-key reasoning as
      ``people.person_id`` in 0012: idempotent re-ingest by ``source_id``
      without renumbering every citation row.
    - ``dictionary_citations`` stores ``start_key``/``end_key`` as an
      inclusive verse range rather than one key per verse, mirroring
      ``routes``/``historical_events`` -- most citations are a single verse
      (``start_key = end_key``), a minority are a same-chapter span.
    - Both dictionaries can define the same headword differently (Easton and
      Smith are independent works), so ``entry_id`` -- not just the headword
      -- is the primary key; a reader wanting both sees two rows.

ON Q-007
    NEUU is CC BY 4.0, not share-alike, so unlike ``people``/``person_*``
    these rows carry no share-alike obligation -- but they still carry
    ``source_id`` per AI-05, so the badge can always name where its citation
    came from.

Revision ID: 0013_dictionary_entries
Revises: 0012_people_lineage
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0013_dictionary_entries"
down_revision = "0012_people_lineage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _create_dictionary_entries()
    _create_dictionary_citations()


def _create_dictionary_entries() -> None:
    """One row per headword, per dictionary."""
    op.execute(
        """
        CREATE TABLE dictionary_entries (
            entry_id        varchar(64) PRIMARY KEY,
            source          varchar(8) NOT NULL,
            source_name     text NOT NULL,
            headword        text NOT NULL,
            display_name    text NOT NULL,
            slug            varchar(96) NOT NULL,
            definition_text text NOT NULL DEFAULT '',
            source_id       int NOT NULL REFERENCES data_sources(id)
        )
        """
    )
    op.execute(
        "CREATE INDEX dictionary_entries_headword_idx "
        "ON dictionary_entries USING gin (headword gin_trgm_ops)"
    )
    op.execute("CREATE INDEX dictionary_entries_slug_idx ON dictionary_entries (slug)")


def _create_dictionary_citations() -> None:
    """Which verses a dictionary entry cites -- the join the badge queries."""
    op.execute(
        """
        CREATE TABLE dictionary_citations (
            entry_id      varchar(64) NOT NULL
                              REFERENCES dictionary_entries(entry_id) ON DELETE CASCADE,
            start_key     int NOT NULL,
            end_key       int NOT NULL,
            raw_reference text NOT NULL,
            source_id     int NOT NULL REFERENCES data_sources(id),
            PRIMARY KEY (entry_id, start_key, end_key),
            CHECK (end_key >= start_key)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX dictionary_citations_range_idx ON dictionary_citations
            USING gist (int4range(start_key, end_key, '[]'))
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS dictionary_citations")
    op.execute("DROP TABLE IF EXISTS dictionary_entries")
