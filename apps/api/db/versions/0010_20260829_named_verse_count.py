"""Count only the verses that SPELL a place, and say so in the column name.

WHY THIS FILE EXISTS
    The 3D City teaser reads "Jerusalem - named in 955 verses of scripture".
    ``places.verse_count`` was ``len(place_mentions)`` for the place, and
    ``place_mentions`` classifies every row: measured on the live database,
    7,333 are ``name`` and 1,409 are not (people_group 458, no_translation 390,
    common_noun 321, helper 138, partial 101, person 1). 766 verses spell
    "Jerusalem"; the other 189 refer to it some other way, and one of them --
    2 Samuel 11:22, "So the messenger set out and reported to David all that
    Joab had sent him to say" -- names no place at all.

    Measured before this revision: ``verse_count`` equalled the unfiltered
    total for all 1,285 places with mentions, and differed from the ``name``
    count for 232 of them. 280 of the 922 3D City badges printed the wrong
    number, and the same number fed the sheet's stat cell and ``_city_score``,
    which decides which badge a chapter shows.

WHY RENAME RATHER THAN JUST FIX THE ARITHMETIC
    ``verse_count`` is a name that invites exactly the reading that was wrong.
    ``named_verse_count`` states the claim the number is allowed to support, so
    the next reader of ``builders/spatial.py`` cannot quietly widen it again.
    0.19.0 closed this same seam for LABELS -- a badge may only tint a word
    that names the place it is about -- and left it open on the count.

    The rename reaches the wire: ``City3dPayloadOut.canon_verse_count`` becomes
    ``named_verse_count``, because a client caching the old field would keep
    rendering the old claim under the old name.

Revision ID: 0010_named_verses
Revises: 0009_simple_usage
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0010_named_verses"
down_revision = "0009_simple_usage"
branch_labels = None
depends_on = None

#: `scripts.place_rows.NAMED_MENTION_KIND`. Restated here because a migration
#: must keep working when that module changes underneath it.
_NAMED = "name"


def upgrade() -> None:
    """Rename the column and recompute it from the mention kinds.

    Recomputed rather than migrated: the old value carries no record of which
    of its mentions were namings, so there is nothing to subtract.
    """
    op.execute("ALTER TABLE places RENAME COLUMN verse_count TO named_verse_count")
    op.execute(
        f"""
        UPDATE places p
           SET named_verse_count = COALESCE(counted.total, 0)
          FROM (SELECT pl.place_id,
                       count(m.verse_key) FILTER (
                           WHERE m.mention_kind = '{_NAMED}') AS total
                  FROM places pl
                  LEFT JOIN place_mentions m ON m.place_id = pl.place_id
                 GROUP BY pl.place_id) counted
         WHERE counted.place_id = p.place_id
        """  # noqa: S608 - the only interpolation is a module constant
    )
    op.execute(
        "COMMENT ON COLUMN places.named_verse_count IS "
        "'Verses whose text spells this place''s name. Counts place_mentions "
        "of kind ''name'' only -- the number the 3D City teaser prints.'"
    )


def downgrade() -> None:
    """Restore the unfiltered count under its old name."""
    op.execute("ALTER TABLE places RENAME COLUMN named_verse_count TO verse_count")
    op.execute(
        """
        UPDATE places p
           SET verse_count = COALESCE(counted.total, 0)
          FROM (SELECT pl.place_id, count(m.verse_key) AS total
                  FROM places pl
                  LEFT JOIN place_mentions m ON m.place_id = pl.place_id
                 GROUP BY pl.place_id) counted
         WHERE counted.place_id = p.place_id
        """
    )
