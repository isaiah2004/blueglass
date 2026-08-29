"""Identity, reader preferences, and chapter study content.

Closes two of the three prototype defects at the schema level:

  1. There is no app_users row seeded with the literal id dev-user. Identity is
     keyed on a subject string minted from a real credential -- today an
     anonymous device id (decision A-01), tomorrow an account id -- and the kind
     column records which, so a later migration to real accounts is a data
     migration and not a guess.

  2. chapter_studies carries author_subject and origin. The prototype stored
     neither, because its write endpoint had no idea who was calling. A row
     whose author is unknown cannot be attributed, retracted, or trusted.

Revision ID: 0002
Revises: 0001
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _create_identities()
    _create_preferences()
    _create_chapter_studies()


def _create_identities() -> None:
    op.execute(
        """
        CREATE TABLE identities (
            subject      text PRIMARY KEY,
            kind         varchar(16) NOT NULL
                             CHECK (kind IN ('device', 'account')),
            created_at   timestamptz NOT NULL DEFAULT now(),
            last_seen_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )


def _create_preferences() -> None:
    """One free-form jsonb object per identity. Kept separate from identities so
    a preference write does not touch the row every request updates."""
    op.execute(
        """
        CREATE TABLE identity_preferences (
            subject     text PRIMARY KEY REFERENCES identities(subject)
                            ON DELETE CASCADE,
            preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
            updated_at  timestamptz NOT NULL DEFAULT now()
        )
        """
    )


def _create_chapter_studies() -> None:
    op.execute(
        """
        CREATE TABLE chapter_studies (
            book_number    smallint NOT NULL CHECK (book_number BETWEEN 1 AND 66),
            chapter        smallint NOT NULL CHECK (chapter > 0),
            content        jsonb NOT NULL,
            model          text,
            origin         varchar(16) NOT NULL DEFAULT 'generated'
                               CHECK (origin IN ('sourced', 'generated', 'authored')),
            author_subject text NOT NULL REFERENCES identities(subject),
            created_at     timestamptz NOT NULL DEFAULT now(),
            updated_at     timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (book_number, chapter)
        )
        """
    )
    op.execute("CREATE INDEX chapter_studies_author_idx ON chapter_studies (author_subject)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chapter_studies")
    op.execute("DROP TABLE IF EXISTS identity_preferences")
    op.execute("DROP TABLE IF EXISTS identities")
