"""Scripture backbone: provenance, translations, verses, passages.

Schema per docs/architecture/data-inventory.md section 7, with decision Q-009:
BOTH verse rows and passage rows exist, denormalised. Verse rows serve the
reading canvas and the verse-level badges; passage rows serve the map and
timeline canvases. Neither is derived from the other at read time, which is the
whole point of the decision -- no join on the path a reader feels.

Revision ID: 0001
Revises:
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The compose stack installs these from infra/db/init on first boot, but a
    # database created any other way must still work.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    _create_data_sources()
    _create_translations()
    _create_verses()
    _create_passages()


def _create_data_sources() -> None:
    """Provenance. Every enrichment row points here, which is what makes the
    share-alike separability rule enforceable with a WHERE clause."""
    op.execute(
        """
        CREATE TABLE data_sources (
            id          serial PRIMARY KEY,
            key         varchar(48) UNIQUE NOT NULL,
            name        text NOT NULL,
            url         text,
            license     text NOT NULL,
            share_alike boolean NOT NULL DEFAULT false,
            attribution text NOT NULL,
            version     text,
            loaded_at   timestamptz
        )
        """
    )


def _create_translations() -> None:
    op.execute(
        """
        CREATE TABLE translations (
            code             varchar(16) PRIMARY KEY,
            name             text NOT NULL,
            language         varchar(8) NOT NULL DEFAULT 'en',
            source_id        int REFERENCES data_sources(id),
            can_redistribute boolean NOT NULL DEFAULT true
        )
        """
    )


def _create_verses() -> None:
    """The hot path. (translation, verse_key) is the natural composite key, so
    fetching a chapter is one index range scan and no surrogate id exists to go
    stale. text_tsv is generated, so it can never disagree with text."""
    op.execute(
        """
        CREATE TABLE verses (
            verse_key   int NOT NULL,
            translation varchar(16) NOT NULL REFERENCES translations(code)
                            ON DELETE CASCADE,
            book_number smallint NOT NULL CHECK (book_number BETWEEN 1 AND 66),
            chapter     smallint NOT NULL CHECK (chapter > 0),
            verse       smallint NOT NULL CHECK (verse > 0),
            osis_id     varchar(32) NOT NULL,
            text        text NOT NULL,
            text_tsv    tsvector GENERATED ALWAYS AS
                            (to_tsvector('english', text)) STORED,
            PRIMARY KEY (translation, verse_key)
        )
        """
    )
    op.execute("CREATE INDEX verses_osis_idx ON verses (translation, osis_id)")
    op.execute(
        "CREATE INDEX verses_ref_idx ON verses (translation, book_number, chapter, verse)"
    )
    # Replaces the prototype's unindexable leading-wildcard ILIKE.
    op.execute("CREATE INDEX verses_tsv_idx ON verses USING gin (text_tsv)")
    op.execute("CREATE INDEX verses_trgm_idx ON verses USING gin (text gin_trgm_ops)")


def _create_passages() -> None:
    """The passage half of Q-009. The GiST range index answers "which passage
    contains verse 44016013?" in one lookup."""
    op.execute(
        """
        CREATE TABLE passages (
            passage_id    varchar(48) PRIMARY KEY,
            book_number   smallint NOT NULL CHECK (book_number BETWEEN 1 AND 66),
            chapter       smallint NOT NULL,
            start_key     int NOT NULL,
            end_key       int NOT NULL,
            title         text,
            literary_type text,
            scheme        varchar(24) NOT NULL DEFAULT 'atlas',
            CHECK (end_key >= start_key)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX passages_range_idx ON passages
            USING gist (int4range(start_key, end_key, '[]'))
        """
    )
    op.execute("CREATE INDEX passages_book_idx ON passages (book_number, chapter)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS passages")
    op.execute("DROP TABLE IF EXISTS verses")
    op.execute("DROP TABLE IF EXISTS translations")
    op.execute("DROP TABLE IF EXISTS data_sources")
