"""History badge: rulers, dated events, and per-passage dating.

The dual-axis timeline in docs/product/mockups/image5.png needs two series --
biblical events on one axis and world rulers on the other -- plus a date for
the passage the reader is standing in. Three tables, one per series plus the
join, rather than one blob: correcting a reign date must fix the whole canon at
once, which it cannot do if the date is copied into thousands of JSON records.

Decision Q-016 -- DATING IS NT-ERA ONLY -- is enforced here as a CHECK
constraint, not as a convention in a loader. The only open per-passage dating
available is Theographic's, which derives from Ussher's chronology (its first
row dates creation to 4004 BC). For the New Testament that chronology is
broadly uncontroversial; for the Old Testament it encodes a position mainstream
scholarship rejects, and shipping it as neutral fact would be a credibility
problem. A book_number bound on both dated tables means an Old Testament
year_approx cannot be inserted by any future loader, however well meant.

Decision AI-05 -- every claim carries a source anchor -- is enforced by
source_id being NOT NULL on all three tables. A row that cannot name where it
came from cannot exist, so a badge can never render an unattributed date.

Decision Q-007 -- share-alike data stays separable -- is why the events table
carries its own source_id rather than being blended: Theographic is CC BY-SA
4.0 and must stay reachable by a WHERE clause. The rulers are CC0 and are not.

Revision ID: 0004_history
Revises: 0003
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0004_history"
down_revision = "0003"
branch_labels = None
depends_on = None

#: Books 40-66. Q-016 in one expression, reused by both dated tables.
_NEW_TESTAMENT_ONLY = "book_number BETWEEN 40 AND 66"

#: The widest window any New Testament event or office can honestly occupy.
#: The Hasmonean kings Wikidata returns alongside the Herodians reach back to
#: 103 BC, and Antoninus Pius -- the last emperor in the acquired table -- dies
#: in AD 161. A year outside this band is a parsing accident, not a datum.
_NT_ERA_YEARS = "BETWEEN -120 AND 180"


def upgrade() -> None:
    _create_rulers()
    _create_historical_events()
    _create_passage_dating()


def _create_rulers() -> None:
    """Who held power when. One row per person per office they held.

    start_year and end_year are nullable because Wikidata genuinely does not
    record a start for Herod the Great or Herod Antipas. Storing NULL says "not
    recorded"; storing a guess would be the badge asserting something no source
    supports.
    """
    op.execute(
        f"""
        CREATE TABLE rulers (
            id             serial PRIMARY KEY,
            external_id    varchar(24),
            name           text NOT NULL,
            realm          text NOT NULL,
            title          text NOT NULL,
            start_year     int,
            end_year       int,
            start_date     date,
            end_date       date,
            date_precision varchar(8) NOT NULL DEFAULT 'year',
            source_id      int NOT NULL REFERENCES data_sources(id),
            CONSTRAINT rulers_identity_key UNIQUE (source_id, external_id, title),
            CONSTRAINT rulers_have_one_bound
                CHECK (start_year IS NOT NULL OR end_year IS NOT NULL),
            CONSTRAINT rulers_in_order
                CHECK (start_year IS NULL OR end_year IS NULL OR end_year >= start_year),
            CONSTRAINT rulers_within_era CHECK (
                (start_year IS NULL OR start_year {_NT_ERA_YEARS})
                AND (end_year IS NULL OR end_year {_NT_ERA_YEARS})
            ),
            CONSTRAINT rulers_precision_known
                CHECK (date_precision IN ('day', 'year'))
        )
        """
    )
    # A plain GiST range index, deliberately not the composite the schema note
    # proposed: indexing (range, realm) together needs the btree_gist extension,
    # and a second btree on realm costs less than a new extension in every
    # environment this schema is ever created in.
    op.execute(
        """
        CREATE INDEX rulers_span_idx ON rulers
            USING gist (int4range(start_year, end_year, '[]'))
        """
    )
    op.execute("CREATE INDEX rulers_realm_idx ON rulers (realm, start_year)")


def _create_historical_events() -> None:
    """Dated biblical events, keyed to the verses that narrate them.

    One row per event per book: the harmonised gospel events carry verses in
    Matthew, Mark and Luke at once, and a single start_key/end_key pair cannot
    describe that without spanning books it does not touch.
    """
    op.execute(
        f"""
        CREATE TABLE historical_events (
            id          serial PRIMARY KEY,
            external_id varchar(24) NOT NULL,
            title       text NOT NULL,
            year_approx int NOT NULL,
            date_label  text NOT NULL,
            book_number smallint NOT NULL,
            start_key   int NOT NULL,
            end_key     int NOT NULL,
            part_of     text,
            source_id   int NOT NULL REFERENCES data_sources(id),
            CONSTRAINT historical_events_identity_key
                UNIQUE (source_id, external_id, book_number),
            CONSTRAINT historical_events_nt_only CHECK ({_NEW_TESTAMENT_ONLY}),
            CONSTRAINT historical_events_nt_era
                CHECK (year_approx {_NT_ERA_YEARS}),
            CONSTRAINT historical_events_in_order CHECK (end_key >= start_key)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX historical_events_range_idx ON historical_events
            USING gist (int4range(start_key, end_key, '[]'))
        """
    )
    op.execute("CREATE INDEX historical_events_year_idx ON historical_events (year_approx)")


def _create_passage_dating() -> None:
    """The date the History badge shows for the passage the reader is in.

    origin is load-bearing: it is the only way the UI can honestly distinguish
    "a dataset says" from "a model wrote this", and every row this milestone
    writes is 'sourced'.
    """
    op.execute(
        f"""
        CREATE TABLE passage_dating (
            passage_id  varchar(48) PRIMARY KEY
                            REFERENCES passages(passage_id) ON DELETE CASCADE,
            book_number smallint NOT NULL,
            year_approx int NOT NULL,
            year_label  text NOT NULL,
            confidence  real,
            origin      varchar(16) NOT NULL DEFAULT 'sourced',
            rationale   text NOT NULL,
            event_id    int REFERENCES historical_events(id) ON DELETE CASCADE,
            source_id   int NOT NULL REFERENCES data_sources(id),
            CONSTRAINT passage_dating_nt_only CHECK ({_NEW_TESTAMENT_ONLY}),
            CONSTRAINT passage_dating_nt_era CHECK (year_approx {_NT_ERA_YEARS}),
            CONSTRAINT passage_dating_origin_known
                CHECK (origin IN ('sourced', 'generated', 'authored')),
            CONSTRAINT passage_dating_confidence_range
                CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
            CONSTRAINT passage_dating_has_rationale CHECK (btrim(rationale) <> '')
        )
        """
    )
    op.execute("CREATE INDEX passage_dating_year_idx ON passage_dating (year_approx)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS passage_dating")
    op.execute("DROP TABLE IF EXISTS historical_events")
    op.execute("DROP TABLE IF EXISTS rulers")
