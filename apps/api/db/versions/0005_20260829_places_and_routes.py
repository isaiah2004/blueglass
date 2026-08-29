"""Places, the gazetteer name index, place mentions, and derived routes.

Powers the Route and 3D City badges. Shaped from
docs/architecture/data-inventory.md section 7, with three deliberate departures
recorded here rather than discovered later.

1. ``places.place_id`` is OpenBible's own ancient-place id, not a bigserial.
   A natural key is what makes a re-ingest idempotent: the surrogate would have
   to be upserted through a unique natural key anyway, so the surrogate earns
   nothing and would silently renumber every route stop on a reload.

2. ``place_names`` is new. Section 7 proposes only a trigram index on
   ``places.name``, which cannot find "Abanah" -- a spelling eight English
   translations use for the place this dataset files under "Abana". The
   gazetteer's whole job is that a model emits a NAME and code resolves the
   coordinate (CLAUDE.md, "Never let a model emit coordinates"), so every
   published spelling gets an indexed row.

3. ``routes`` / ``route_stops`` are new. Section 7 has no route shape at all.
   Order comes from verse order, never from a model.

ON SCHOLARLY DISAGREEMENT
    777 of the 1,342 ancient places have more than one candidate modern site --
    the majority case, not an edge case. ``candidates`` keeps every one with its
    score, and ``candidate_count`` is GENERATED from it so the two can never
    disagree. DECISIONS #10 forbids collapsing disagreement to a single pin;
    ``lat``/``lng`` hold the best-scoring candidate for the default marker and
    the alternates stay one column away.

ON ROUTE SCHEME
    ``scheme`` is 'chapter' for everything this migration's loader derives,
    because the passages table is still empty. Hub question Q-024 asks whether
    passage-level routes should have blocked the badge instead; the column means
    a 'passage' scheme can be added beside these rows rather than replacing
    them.

Revision ID: 0005
Revises: 0004
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _create_places()
    _create_place_names()
    _create_place_mentions()
    _create_routes()


def _create_places() -> None:
    """One row per ancient place, carrying its best pin and every alternate."""
    op.execute(
        """
        CREATE TABLE places (
            place_id         varchar(16) PRIMARY KEY,
            name             text NOT NULL,
            slug             varchar(64) NOT NULL,
            modern_name      text,
            lng              double precision,
            lat              double precision,
            feature_type     text NOT NULL,
            feature_types    text[] NOT NULL DEFAULT '{}',
            confidence       real,
            precision_meters int,
            precision_type   varchar(16),
            candidates       jsonb NOT NULL DEFAULT '[]',
            candidate_count  smallint GENERATED ALWAYS AS
                                 (jsonb_array_length(candidates)) STORED,
            verse_count      int NOT NULL DEFAULT 0,
            source_id        int NOT NULL REFERENCES data_sources(id),
            CHECK ((lat IS NULL) = (lng IS NULL)),
            CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
            CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
            CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1)
        )
        """
    )
    op.execute("CREATE INDEX places_name_idx ON places USING gin (name gin_trgm_ops)")
    op.execute(
        "CREATE INDEX places_located_idx ON places (feature_type) WHERE lat IS NOT NULL"
    )


def _create_place_names() -> None:
    """The gazetteer index: a normalised spelling resolves to a place."""
    op.execute(
        """
        CREATE TABLE place_names (
            normalised varchar(64) NOT NULL,
            name       text NOT NULL,
            place_id   varchar(16) NOT NULL
                           REFERENCES places(place_id) ON DELETE CASCADE,
            kind       varchar(16) NOT NULL,
            weight     int NOT NULL DEFAULT 0,
            PRIMARY KEY (normalised, place_id, kind)
        )
        """
    )
    # A name that resolves to several places is normal (there are two Antiochs).
    # weight DESC puts the most-attested reading first without a sort.
    op.execute("CREATE INDEX place_names_lookup_idx ON place_names (normalised, weight DESC)")


def _create_place_mentions() -> None:
    """Which places are named in a verse -- the question the badge asks."""
    op.execute(
        """
        CREATE TABLE place_mentions (
            place_id     varchar(16) NOT NULL
                             REFERENCES places(place_id) ON DELETE CASCADE,
            verse_key    int NOT NULL,
            osis_id      varchar(32) NOT NULL,
            mention_kind varchar(16) NOT NULL,
            role         text,
            PRIMARY KEY (place_id, verse_key)
        )
        """
    )
    op.execute("CREATE INDEX place_mentions_verse_idx ON place_mentions (verse_key)")


def _create_routes() -> None:
    """An ordered sequence of located places over a span of verses."""
    op.execute(
        """
        CREATE TABLE routes (
            route_id    varchar(48) PRIMARY KEY,
            scheme      varchar(24) NOT NULL DEFAULT 'chapter',
            book_number smallint NOT NULL CHECK (book_number BETWEEN 1 AND 66),
            chapter     smallint NOT NULL CHECK (chapter > 0),
            start_key   int NOT NULL,
            end_key     int NOT NULL,
            stop_count  smallint NOT NULL CHECK (stop_count >= 2),
            source_id   int NOT NULL REFERENCES data_sources(id),
            CHECK (end_key >= start_key)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX routes_range_idx ON routes
            USING gist (int4range(start_key, end_key, '[]'))
        """
    )
    op.execute("CREATE INDEX routes_book_idx ON routes (book_number, chapter)")
    op.execute(
        """
        CREATE TABLE route_stops (
            route_id  varchar(48) NOT NULL
                          REFERENCES routes(route_id) ON DELETE CASCADE,
            position  smallint NOT NULL CHECK (position >= 1),
            place_id  varchar(16) NOT NULL
                          REFERENCES places(place_id) ON DELETE CASCADE,
            verse_key int NOT NULL,
            PRIMARY KEY (route_id, position)
        )
        """
    )
    op.execute("CREATE INDEX route_stops_place_idx ON route_stops (place_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS route_stops")
    op.execute("DROP TABLE IF EXISTS routes")
    op.execute("DROP TABLE IF EXISTS place_mentions")
    op.execute("DROP TABLE IF EXISTS place_names")
    op.execute("DROP TABLE IF EXISTS places")
