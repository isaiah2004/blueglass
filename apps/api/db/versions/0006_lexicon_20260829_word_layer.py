"""Original-language word layer: lexicon, verse words, English alignment, usage.

Powers the [Root] badge. Schema follows docs/architecture/data-inventory.md
section 7 ("Word layer"), with three additions that section did not anticipate:

  1. `definition_source_id` beside `source_id`. A lexeme's headword and gloss
     come from one source and its long definition often from another (TBESG's
     Abbott-Smith gloss with Dodson's CC0 definition). AI-05 requires the sheet
     to name the source of every claim it renders, so the row carries both, and
     a CHECK makes a definition without provenance impossible to store.
  2. `verse_word_alignments`. Nothing in the acquired data says which ENGLISH
     word a Greek word became; that mapping is computed, so it is stored apart
     from the sourced rows, with the method and confidence that produced it.
  3. `lexicon_usage`. The Root sheet's stat strip ("10 occurrences, 9 verses,
     7 books") is three aggregates over 142k word rows. AI-07 says badge content
     is pre-computed; this is that pre-computation.

`data_sources` also gains `retrieved_at`: the ingest brief requires the source,
licence AND retrieval date to live in the database, not only in a PROVENANCE.md
that never ships. Added IF NOT EXISTS because several agents extend this table.

Revision ID: 0006_lexicon
Revises: 0005
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0006_lexicon"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS retrieved_at date")
    _create_lexicon()
    _create_verse_words()
    _create_alignments()
    _create_usage()


def _create_lexicon() -> None:
    """One row per lemma, keyed by STEPBible's DISAMBIGUATED Strong's number.

    Keying on dStrong rather than plain Strong's is what lets the sheet say
    "Lydia the seller of purple" instead of "Lydia, and also the region": the
    three NT Herods are G2264G/H/I here, one row each. `simple_strongs` keeps
    the number a reader recognises, and is what the badge prints.
    """
    op.execute(
        """
        CREATE TABLE lexicon (
            strongs              varchar(16) PRIMARY KEY,
            simple_strongs       varchar(16) NOT NULL,
            lang                 varchar(8) NOT NULL
                                     CHECK (lang IN ('greek', 'hebrew', 'aramaic')),
            lemma                text NOT NULL,
            translit             text,
            pos                  text,
            short_gloss          text,
            definition           text,
            definition_source_id int REFERENCES data_sources(id),
            source_id            int NOT NULL REFERENCES data_sources(id),
            CHECK (definition IS NULL OR definition_source_id IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX lexicon_simple_idx ON lexicon (simple_strongs)")
    op.execute("CREATE INDEX lexicon_lang_idx ON lexicon (lang)")
    op.execute("CREATE INDEX lexicon_lemma_idx ON lexicon USING gin (lemma gin_trgm_ops)")


def _create_verse_words() -> None:
    """One row per word of the original text, in original word order.

    `strongs` is NOT NULL and a real foreign key on purpose: data-inventory.md
    section 7 records that a tagger emitting numbers no lexicon covers is a real
    failure mode in this data, and it is. Five dStrongs used by TAGNT are absent
    from TBESG; the loader mints lexicon rows for them from TAGNT's own
    dictionary-form column rather than dropping 317 words on the floor.

    `variant_code` and `editions` are the manuscript-attestation layer. They are
    not read by any M2 badge; they are stored because they arrive in the same
    row and re-parsing 30 MB later to recover them would be waste.
    """
    op.execute(
        """
        CREATE TABLE verse_words (
            id           bigserial PRIMARY KEY,
            verse_key    int NOT NULL,
            word_index   smallint NOT NULL CHECK (word_index > 0),
            surface      text NOT NULL,
            translit     text,
            lemma        text,
            strongs      varchar(16) NOT NULL REFERENCES lexicon(strongs),
            morph        text,
            gloss        text,
            variant_code varchar(16),
            editions     text,
            source_id    int NOT NULL REFERENCES data_sources(id),
            UNIQUE (verse_key, source_id, word_index)
        )
        """
    )
    op.execute("CREATE INDEX verse_words_key_idx ON verse_words (verse_key, word_index)")
    op.execute("CREATE INDEX verse_words_strongs_idx ON verse_words (strongs)")


def _create_alignments() -> None:
    """Which English word in a translation renders which original word.

    Computed, not sourced: no acquired dataset carries it. The primary key is
    (translation, verse_key, token_index), so one English word points at exactly
    one original word and a re-run cannot double it. Several English words may
    point at the same original word -- KJV's "seller of purple" is one Greek
    noun -- which is why verse_word_id is not unique.

    char_start/char_end are offsets into `verses.text`, so the reader can tint
    and tap the exact substring without re-tokenising the verse identically to
    this loader. A tokeniser drift on the client would silently mis-highlight.
    """
    op.execute(
        """
        CREATE TABLE verse_word_alignments (
            translation   varchar(16) NOT NULL REFERENCES translations(code)
                              ON DELETE CASCADE,
            verse_key     int NOT NULL,
            token_index   smallint NOT NULL CHECK (token_index >= 0),
            token         text NOT NULL,
            char_start    int NOT NULL CHECK (char_start >= 0),
            char_end      int NOT NULL,
            verse_word_id bigint NOT NULL REFERENCES verse_words(id) ON DELETE CASCADE,
            method        varchar(16) NOT NULL
                              CHECK (method IN ('gloss-exact', 'gloss-stem')),
            confidence    real NOT NULL CHECK (confidence > 0 AND confidence <= 1),
            source_id     int NOT NULL REFERENCES data_sources(id),
            PRIMARY KEY (translation, verse_key, token_index),
            CHECK (char_end > char_start)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX verse_word_alignments_word_idx
            ON verse_word_alignments (verse_word_id)
        """
    )


def _create_usage() -> None:
    """Pre-computed stat strip for the Root sheet, one row per attested lemma.

    Derived from verse_words in the same transaction that writes them, so the
    counts can never describe a different corpus than the one on disk.
    """
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


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS lexicon_usage")
    op.execute("DROP TABLE IF EXISTS verse_word_alignments")
    op.execute("DROP TABLE IF EXISTS verse_words")
    op.execute("DROP TABLE IF EXISTS lexicon")
    # retrieved_at is deliberately left in place: another migration may have
    # added it, and dropping a column this one did not necessarily create would
    # destroy provenance belonging to someone else's rows.
