"""Take OpenBible's homonym ordinal out of the name a reader is shown.

WHY THIS FILE EXISTS
    ``places.name`` was loaded straight from OpenBible's ``friendly_id``, which
    is an identifier rather than a label. Where several places share a name the
    source disambiguates them with a trailing ordinal, and 315 of the 1,342
    loaded places carried one: "Ramah 1" .. "Ramah 9", "Achzib 2", "Bethsaida 2".
    Measured on the live database before this revision, that reached the reader
    through 2,305 place mentions across 1,983 verses and 1,827 stops on 485
    routes.

    A badge that prints "Ramah 2" beside scripture is asserting something no
    manuscript says. Pillar 3 -- "every claim carries a citation, or it is not
    rendered" -- makes that the worst class of bug in this product, because
    unlike a crash it is believed.

WHY NOT JUST STRIP IT
    Because nine towns would then share one label with nothing to tell them
    apart, and losing the distinction is a worse failure than showing the
    ordinal. The ordinal is moved into structured columns instead:

      disambiguation_index  the source's ordinal, retained verbatim. With
                            ``slug`` (which already holds "ramah-2") this makes
                            name + index a lossless round-trip to friendly_id.
      homonym_count         how many places carry this exact name. > 1 is the
                            signal a sheet must act on: say the name is shared
                            rather than silently present one of them as "the"
                            Ramah (DECISIONS #10, the same rule that keeps 777
                            rival candidate sites visible).
      disambiguation        OpenBible's own note -- "in Judah", "in Asher" --
                            reduced from its published HTML to plain text.
                            Populated for 275 places; NULL, never invented,
                            for the rest.

    The scope is deliberately ``places.name`` alone. ``place_names.name`` and
    ``places.modern_name`` are NOT touched: "Feldstein et al Site 43" is a real
    archaeological site name in modern.jsonl, and a blanket strip would have
    renamed it.

THE CHECK CONSTRAINT
    ``places_name_carries_no_index`` makes the regression impossible rather
    than merely tested: the loader COPYs inside one transaction, so a name that
    still carried an ordinal would abort the load instead of publishing it.

Revision ID: 0008_place_names
Revises: 0007_merge
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0008_place_names"
down_revision = "0007_merge"
branch_labels = None
depends_on = None

#: A space then digits at the end of the name. Kept identical to
#: scripts.place_disambiguation.NAME_INDEX_SQL_PATTERN, which is what the
#: loader's assertions query with, so the constraint and the check cannot
#: drift apart.
_NAME_INDEX_PATTERN = " [0-9]+$"


def upgrade() -> None:
    """Add the disambiguation columns, backfill them, then forbid the artefact.

    The backfill uses the same trailing-ordinal rule as the loader, so an
    existing database ends up with exactly what a fresh ingest would write and
    the constraint can be added without a reload.
    """
    op.execute(
        """
        ALTER TABLE places
            ADD COLUMN disambiguation_index smallint,
            ADD COLUMN homonym_count smallint NOT NULL DEFAULT 1,
            ADD COLUMN disambiguation text
        """
    )
    op.execute(
        f"""
        UPDATE places
           SET disambiguation_index =
                   btrim(substring(name FROM '{_NAME_INDEX_PATTERN}'))::smallint,
               name = regexp_replace(name, '{_NAME_INDEX_PATTERN}', '')
         WHERE name ~ '{_NAME_INDEX_PATTERN}'
        """  # noqa: S608 - the only interpolation is a module constant
    )
    op.execute(
        """
        UPDATE places p
           SET homonym_count = shared.count
          FROM (SELECT name, count(*) AS count FROM places GROUP BY name) shared
         WHERE shared.name = p.name
        """
    )
    op.execute(
        f"""
        ALTER TABLE places ADD CONSTRAINT places_name_carries_no_index
            CHECK (name !~ '{_NAME_INDEX_PATTERN}')
        """
    )
    op.execute(
        "COMMENT ON COLUMN places.name IS "
        "'The label a reader sees. Never carries OpenBible''s homonym ordinal.'"
    )
    op.execute(
        "COMMENT ON COLUMN places.homonym_count IS "
        "'How many places share this name. Above 1 the sheet must say so.'"
    )


def downgrade() -> None:
    """Put the ordinal back into the name and drop the columns.

    Reversible because the ordinal was retained: re-joining it to the name
    reproduces the previous rows exactly.
    """
    op.execute("ALTER TABLE places DROP CONSTRAINT places_name_carries_no_index")
    op.execute(
        """
        UPDATE places
           SET name = name || ' ' || disambiguation_index
         WHERE disambiguation_index IS NOT NULL
        """
    )
    op.execute(
        """
        ALTER TABLE places
            DROP COLUMN disambiguation_index,
            DROP COLUMN homonym_count,
            DROP COLUMN disambiguation
        """
    )
