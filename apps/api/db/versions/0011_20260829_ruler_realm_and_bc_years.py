"""Say only what Wikidata says about a ruler, and read its BC years correctly.

WHY THIS FILE EXISTS -- TWO DEFECTS, ONE TABLE
    1. A REALM THE SOURCE DOES NOT CARRY.
       ``data/raw/wikidata-rulers/nt-era-officials.json`` gives Herod Antipas
       and Philip the Tetrarch the office label "tetrarch" and NO territory.
       The ingest hard-coded ``realm = 'Judaea'`` for the bare office and the
       History badge composed it into a sentence: "Herod Antipas, Tetrarch of
       Judaea" rendered on 188 badges and "Philip the Tetrarch, Tetrarch of
       Judaea" on 181. Antipas was tetrarch of Galilee and Peraea, Philip of
       Iturea and Trachonitis -- which is exactly the distinction Luke 3:1
       draws by listing them apart from Pilate. The badge carried a Wikidata
       CC0 citation for a claim Wikidata does not make.

       ``realm`` becomes nullable and the tetrarchs' is set to NULL. A lane
       with no name is honest; a lane with the wrong name is not.

    2. EVERY BC YEAR WAS ONE YEAR LATE.
       Wikidata serialises XSD dateTime astronomically -- year zero exists and
       is 1 BC -- so ``-0003`` is 4 BC. The parser returned ``abs(year)``, so
       the badge printed "3 BC to AD 34" for a reign that began in 4 BC. All
       four BC bounds in the acquired files agree with every reference work
       once the offset is applied and with none of them before: Herod the
       Great died 4 BC, Herod Archelaus acceded 4 BC, Philip acceded 4 BC,
       Augustus's principate began 27 BC. 10 of the 43 loaded rulers carry a BC
       bound; roughly 380 badge renders showed the wrong number.

       Theographic's event years are plain BC already, so this also makes the
       two axes of the same timeline comparable as integers.

Revision ID: 0011_ruler_realm
Revises: 0010_named_verses
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0011_ruler_realm"
down_revision = "0010_named_verses"
branch_labels = None
depends_on = None

#: `scripts.history_assertions.BARE_OFFICE_TITLE`. The one office in the
#: acquired files whose Wikidata label names no territory.
_BARE_OFFICE = "Tetrarch"

#: What the ingest used to write for it.
_ASSUMED_REALM = "Judaea"


def upgrade() -> None:
    """Drop the invented realm, and move every BC bound back one year."""
    op.execute("ALTER TABLE rulers ALTER COLUMN realm DROP NOT NULL")
    op.execute(
        f"UPDATE rulers SET realm = NULL WHERE title = '{_BARE_OFFICE}'"  # noqa: S608
    )
    op.execute(
        """
        UPDATE rulers
           SET start_year = CASE WHEN start_year < 0 THEN start_year - 1
                                 ELSE start_year END,
               end_year   = CASE WHEN end_year   < 0 THEN end_year   - 1
                                 ELSE end_year   END
         WHERE start_year < 0 OR end_year < 0
        """
    )
    op.execute(
        "COMMENT ON COLUMN rulers.realm IS "
        "'The territory the SOURCE names for this office, or NULL when its "
        "label carries none. Never inferred from the person.'"
    )
    op.execute(
        "COMMENT ON COLUMN rulers.start_year IS "
        "'Historical year: negative is BC as a reference work prints it, "
        "already converted out of Wikidata''s astronomical numbering.'"
    )


def downgrade() -> None:
    """Put the astronomical years and the assumed realm back."""
    op.execute(
        """
        UPDATE rulers
           SET start_year = CASE WHEN start_year < 0 THEN start_year + 1
                                 ELSE start_year END,
               end_year   = CASE WHEN end_year   < 0 THEN end_year   + 1
                                 ELSE end_year   END
         WHERE start_year < 0 OR end_year < 0
        """
    )
    op.execute(
        f"UPDATE rulers SET realm = '{_ASSUMED_REALM}' "  # noqa: S608
        f"WHERE realm IS NULL AND title = '{_BARE_OFFICE}'"
    )
    op.execute("ALTER TABLE rulers ALTER COLUMN realm SET NOT NULL")
