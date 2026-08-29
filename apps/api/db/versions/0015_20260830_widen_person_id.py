"""Widen people.person_id (and its foreign-key columns) past 32 characters.

Purpose
    ``0012_20260829_people_and_lineage.py`` sized ``person_id`` at
    ``varchar(32)`` on the assumption that Theographic's ``personLookup``
    slugs are short. Running the real loader against the real, current
    ``People.csv`` (not a sample) surfaced rows Theographic disambiguates
    with long compound slugs -- e.g. ``mother_of_aholah_and_aholibah_2109``,
    34 characters -- which ``asyncpg`` rejects with
    ``StringDataRightTruncationError`` rather than silently truncating.
    That is the correct failure mode (a truncated primary key would corrupt
    every foreign key pointing at it), but the fix is a wider column, not a
    shorter slug: Theographic's naming scheme is not this codebase's to
    change.

Shape decision
    ``varchar(64)`` -- double the longest real slug seen (34 chars), so the
    same class of long disambiguating names does not re-trigger this the
    next time Theographic adds one.
"""

from alembic import op

revision = "0015_widen_person_id"
down_revision = "0014_ai_spend_ledger"
branch_labels = None
depends_on = None

_COLUMNS = (
    ("people", "person_id"),
    ("person_relations", "from_person_id"),
    ("person_relations", "to_person_id"),
    ("person_mentions", "person_id"),
)


def upgrade() -> None:
    for table, column in _COLUMNS:
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE varchar(64)")


def downgrade() -> None:
    for table, column in _COLUMNS:
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE varchar(32)")
