"""Merge the two branches the parallel ingest agents created. No schema change.

WHY THIS FILE EXISTS
    Several agents author migrations in this repository at the same time. On
    2026-08-29 two of them branched from 0003 independently:

        0003 -> 0004 (cross-references) -> 0005 (places) -> 0006_lexicon
        0003 -> 0004_history            -> 0005_structure

    Alembic then had two heads, and `alembic upgrade head` -- which the compose
    stack runs before the API is allowed to start -- failed outright with
    "Multiple head revisions are present". Nothing was wrong with either branch;
    they touch disjoint tables. They simply had no common descendant.

    This revision is that descendant. It creates nothing, drops nothing, and
    exists only so that "head" is again a single revision.

    Verified by tests/integration/test_schema.py, which computes the head from
    the files rather than hardcoding it and fails when more than one exists --
    so the next branch is caught by the suite instead of by a broken stack.

Revision ID: 0007_merge
Revises: 0005_structure, 0006_lexicon
Created: 2026-08-29
"""

from __future__ import annotations

revision = "0007_merge"
down_revision = ("0005_structure", "0006_lexicon")
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Nothing to do: this revision only rejoins two branches."""


def downgrade() -> None:
    """Nothing to undo."""
