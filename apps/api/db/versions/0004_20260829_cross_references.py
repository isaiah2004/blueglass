"""Cross-references, and the retrieval date every provenance row now carries.

Two things happen here.

1. ``data_sources`` gains ``retrieved_at``. AI-05 requires a badge to name its
   source, and "when was this fetched" is part of naming it -- a 2021 gazetteer
   and a 2026 cross-reference dump are not equally fresh, and the reader is
   entitled to know which. It is nullable and added IF NOT EXISTS so the
   scripture loader, which does not set it, keeps working untouched.

2. ``cross_references`` lands, shaped exactly as
   docs/architecture/data-inventory.md section 7 proposes.

ON STORING A RANGE RATHER THAN EXPANDING IT
    88,150 of the 344,799 published rows name a range as their target, 637 of
    them crossing a chapter boundary and 18 crossing a book boundary. Expanding
    those into one row per verse would need a versification table the source
    file does not carry, and would throw away the fact that the reference is to
    a passage. Both endpoints are stored instead, so the badge can render
    "Rom 8:1-4" as one chip rather than four.

ON KEEPING NEGATIVE VOTES
    3,506 rows sit at or below zero votes. They are loaded. DECISIONS #11
    filters on ``votes > 0`` at read time, and a filter that lives in a query
    can be tuned; one applied at ingest cannot be undone without a re-load.

Revision ID: 0004
Revises: 0003
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS retrieved_at date")
    _create_cross_references()


def _create_cross_references() -> None:
    """The Cross-Ref badge's whole storage layer.

    The natural triple is the primary key: it is what makes a re-ingest
    idempotent, and it removes a surrogate id nothing would ever join on.
    """
    op.execute(
        """
        CREATE TABLE cross_references (
            from_key     int NOT NULL,
            to_start_key int NOT NULL,
            to_end_key   int NOT NULL,
            votes        int NOT NULL DEFAULT 0,
            source_id    int NOT NULL REFERENCES data_sources(id),
            PRIMARY KEY (from_key, to_start_key, to_end_key),
            CHECK (to_end_key >= to_start_key)
        )
        """
    )
    # The badge's only hot query: "the cross-references for this verse, best
    # first". votes DESC in the index means the top ten need no sort.
    op.execute("CREATE INDEX xref_from_idx ON cross_references (from_key, votes DESC)")
    # Reverse lookup: "what points AT this verse?" -- the same badge read from
    # the other end, and the cheapest way to spot a verse nothing cites.
    op.execute("CREATE INDEX xref_to_idx ON cross_references (to_start_key)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS cross_references")
    op.execute("ALTER TABLE data_sources DROP COLUMN IF EXISTS retrieved_at")
