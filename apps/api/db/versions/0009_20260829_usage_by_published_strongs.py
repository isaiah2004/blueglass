"""Count the word layer under the Strong's number the badge actually prints.

WHY THIS FILE EXISTS
    ``lexicon`` is keyed on STEPBible's DISAMBIGUATED Strong's number, so the
    four senses of Ἰησοῦς are G2424G/H/I/J/K, one row each. ``lexicon_usage``
    was keyed on the same column, so its counts describe ONE SENSE. The Root
    badge, however, publishes ``lexicon.simple_strongs`` -- the number a reader
    recognises and can look up -- beside those per-sense counts.

    The two numbers were therefore about different things, and the sheet said
    so out loud. Measured on the live database before this revision, 26 of the
    1,035 Root badges printed a sentence no concordance supports:

      Colossians 4:11  Ἰησοῦς · STRONG'S G2424 · 1 USE, 1 VERSE, 1 BOOK
                       "This word occurs once in the whole of the Greek New
                       Testament."   -- G2424 occurs 992 times, and Colossians
                       4:12 on the same screen reads "Christ Jesus".
      Romans 9:20      ποιέω · G4160 · the same sentence. G4160 occurs 579 times.

    Worse, the badge builder selects the RAREST word in a verse, so an
    artificially rare sense split was preferentially chosen: the defect
    selected for itself.

WHY RE-KEY RATHER THAN PRINT THE DISAMBIGUATED NUMBER
    Printing "G2424K" would make the count checkable only against a key no
    concordance carries, and every other line of the sheet is already
    simple-level: the headword is Ἰησοῦς for all five senses and the definition
    ("John: the Baptist, the apostle, ... or John Mark") is Dodson's entry for
    the simple number. Counting under the published number makes the whole
    sheet agree, and the 88 sense-split lexemes then measure above the badge's
    twelve-occurrence rarity bar and stop earning a badge at all -- which is
    the honest outcome, because they are not rare words.

    The per-sense split is not lost: it is still in ``lexicon`` and in
    ``verse_words.strongs``, which is what lets the sheet gloss this Ἰησοῦς as
    "Joshua". Only the COUNTS move, because only the counts are published
    beside the simple number.

Revision ID: 0009_simple_usage
Revises: 0008_place_names
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0009_simple_usage"
down_revision = "0008_place_names"
branch_labels = None
depends_on = None

#: Aggregate the loaded word rows under the number the badge prints. Identical
#: to `scripts.lexicon.word_layer_writer._BUILD_USAGE` except that the loader
#: scopes itself to one source id; keeping the two in step is what lets an
#: existing database skip a reload.
_BACKFILL = """
    INSERT INTO lexicon_usage
        (simple_strongs, occurrence_count, verse_count, book_count,
         first_verse_key, source_id)
    SELECT l.simple_strongs,
           count(*),
           count(DISTINCT w.verse_key),
           count(DISTINCT w.verse_key / 1000000),
           min(w.verse_key),
           min(w.source_id)
      FROM verse_words w
      JOIN lexicon l ON l.strongs = w.strongs
     GROUP BY l.simple_strongs
"""

#: The shape this revision replaces: one row per disambiguated sense.
_RESTORE = """
    INSERT INTO lexicon_usage
        (strongs, occurrence_count, verse_count, book_count, first_verse_key,
         source_id)
    SELECT strongs,
           count(*),
           count(DISTINCT verse_key),
           count(DISTINCT verse_key / 1000000),
           min(verse_key),
           min(source_id)
      FROM verse_words
     GROUP BY strongs
"""


def upgrade() -> None:
    """Re-key the aggregate on `simple_strongs` and rebuild it from the words.

    Rebuilt rather than migrated: summing the per-sense rows would double-count
    every verse and book in which two senses of one number both occur, and a
    verse counted twice is the same class of false claim this revision closes.
    """
    op.execute("DROP TABLE IF EXISTS lexicon_usage")
    op.execute(
        """
        CREATE TABLE lexicon_usage (
            simple_strongs   varchar(16) PRIMARY KEY,
            occurrence_count int NOT NULL CHECK (occurrence_count > 0),
            verse_count      int NOT NULL CHECK (verse_count > 0),
            book_count       int NOT NULL CHECK (book_count > 0),
            first_verse_key  int NOT NULL,
            source_id        int NOT NULL REFERENCES data_sources(id)
        )
        """
    )
    op.execute(_BACKFILL)
    op.execute(
        "COMMENT ON TABLE lexicon_usage IS "
        "'Usage counts under the Strong''s number the Root badge prints. "
        "Keyed on lexicon.simple_strongs so the number shown and the number "
        "counted are the same number.'"
    )


def downgrade() -> None:
    """Put the per-sense aggregate back, rebuilt from the same word rows."""
    op.execute("DROP TABLE IF EXISTS lexicon_usage")
    op.execute(
        """
        CREATE TABLE lexicon_usage (
            strongs          varchar(16) PRIMARY KEY REFERENCES lexicon(strongs)
                                 ON DELETE CASCADE,
            occurrence_count int NOT NULL CHECK (occurrence_count > 0),
            verse_count      int NOT NULL CHECK (verse_count > 0),
            book_count       int NOT NULL CHECK (book_count > 0),
            first_verse_key  int NOT NULL,
            source_id        int NOT NULL REFERENCES data_sources(id)
        )
        """
    )
    op.execute(_RESTORE)
