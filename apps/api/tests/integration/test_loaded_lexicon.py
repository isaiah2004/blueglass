"""What is actually in the database after `python -m scripts.ingest_lexicon`.

These tests assert MEASURED facts about the loaded corpus, so a loader that
silently half-ran, mis-versified, or lost its provenance fails here rather than
on a reader's screen. They skip rather than fail when the word layer has not
been loaded, because the schema tests already cover the empty case.
"""

from __future__ import annotations

import asyncpg
import pytest

pytestmark = pytest.mark.integration

#: Measured from data/raw/stepbible/TAGNT_*.txt on 2026-08-29.
EXPECTED_GREEK_WORDS = 142_096
EXPECTED_NT_VERSES = 7_957
EXPECTED_GREEK_LEXEMES = 11_040
EXPECTED_HEBREW_LEXEMES = 8_674

#: The mockup's own example: docs/product/mockups/image6.png.
ACTS_16_14 = 44_016_014
WORSHIPER_STRONGS = "G4576"


async def _count(connection: asyncpg.Connection, sql: str, *args: object) -> int:
    return int(await connection.fetchval(sql, *args) or 0)


async def _require_loaded(connection: asyncpg.Connection) -> None:
    if not await _count(connection, "SELECT count(*) FROM verse_words"):
        pytest.skip("word layer not loaded; run python -m scripts.ingest_lexicon")


async def test_the_whole_greek_new_testament_is_present(
    connection: asyncpg.Connection,
) -> None:
    await _require_loaded(connection)
    assert await _count(connection, "SELECT count(*) FROM verse_words") == EXPECTED_GREEK_WORDS
    assert (
        await _count(connection, "SELECT count(DISTINCT verse_key) FROM verse_words")
        == EXPECTED_NT_VERSES
    )


async def test_every_tagged_word_lands_on_a_verse_the_reader_can_open(
    connection: asyncpg.Connection,
) -> None:
    """The versification gate. TAGNT is NRSV-numbered; `verses` is KJV. Without
    the inline [chapter.verse] override this fails on 235 words."""
    await _require_loaded(connection)
    orphans = await _count(
        connection,
        """
        SELECT count(DISTINCT w.verse_key) FROM verse_words w
         WHERE NOT EXISTS (SELECT 1 FROM verses v
                            WHERE v.translation = 'KJV' AND v.verse_key = w.verse_key)
        """,
    )
    assert orphans == 0


async def test_the_greek_covers_every_kjv_new_testament_verse(
    connection: asyncpg.Connection,
) -> None:
    await _require_loaded(connection)
    uncovered = await _count(
        connection,
        """
        SELECT count(*) FROM verses v
         WHERE v.translation = 'KJV' AND v.book_number >= 40
           AND NOT EXISTS (SELECT 1 FROM verse_words w WHERE w.verse_key = v.verse_key)
        """,
    )
    assert uncovered == 0


async def test_both_lexicon_languages_loaded(connection: asyncpg.Connection) -> None:
    await _require_loaded(connection)
    assert (
        await _count(connection, "SELECT count(*) FROM lexicon WHERE lang = 'greek'")
        == EXPECTED_GREEK_LEXEMES
    )
    assert (
        await _count(
            connection,
            "SELECT count(*) FROM lexicon WHERE lang IN ('hebrew', 'aramaic')",
        )
        == EXPECTED_HEBREW_LEXEMES
    )


async def test_every_claim_names_its_source(connection: asyncpg.Connection) -> None:
    """AI-05, checked over the loaded rows rather than over one insert."""
    await _require_loaded(connection)
    assert not await _count(
        connection,
        "SELECT count(*) FROM lexicon "
        "WHERE definition IS NOT NULL AND definition_source_id IS NULL",
    )
    unattributed = await _count(
        connection,
        """
        SELECT count(*) FROM lexicon l
          JOIN data_sources s ON s.id = l.source_id
         WHERE s.attribution IS NULL OR s.attribution = '' OR s.retrieved_at IS NULL
        """,
    )
    assert unattributed == 0


async def test_no_word_layer_source_is_share_alike(
    connection: asyncpg.Connection,
) -> None:
    """Q-007's separability rule is a WHERE clause, and this side of it is empty."""
    await _require_loaded(connection)
    assert not await _count(
        connection,
        """
        SELECT count(*) FROM data_sources
         WHERE share_alike AND key IN ('stepbible_tagnt', 'stepbible_tbesg',
               'dodson_greek_lexicon', 'oshb_hebrew_lexicon', 'atlas_gloss_alignment')
        """,
    )


async def test_the_mockup_sheet_can_be_built_from_the_database(
    connection: asyncpg.Connection,
) -> None:
    """Tap "worshiper" in BSB Acts 16:14 and every field of image6.png is there."""
    await _require_loaded(connection)
    row = await connection.fetchrow(
        """
        SELECT a.token, a.char_start, a.char_end, l.simple_strongs, l.lemma,
               l.translit, l.short_gloss, l.definition, u.occurrence_count,
               u.verse_count, u.book_count, v.text
          FROM verse_word_alignments a
          JOIN verse_words w ON w.id = a.verse_word_id
          JOIN lexicon l ON l.strongs = w.strongs
          JOIN lexicon_usage u ON u.simple_strongs = l.simple_strongs
          JOIN verses v ON v.translation = a.translation AND v.verse_key = a.verse_key
         WHERE a.translation = 'BSB' AND a.verse_key = $1 AND a.token = 'worshiper'
        """,
        ACTS_16_14,
    )
    if row is None:
        pytest.skip("BSB is not loaded")
    assert row["simple_strongs"] == WORSHIPER_STRONGS
    assert row["lemma"] == "σέβομαι"
    assert row["translit"] == "sebomai"
    assert row["definition"]
    assert row["occurrence_count"] >= row["verse_count"] >= row["book_count"] >= 1
    assert row["text"][row["char_start"] : row["char_end"]] == "worshiper"


async def test_every_alignment_slices_back_to_its_own_token(
    connection: asyncpg.Connection,
) -> None:
    """The client tints text by character offset. An offset that does not slice
    back to the stored token would silently highlight the wrong word."""
    await _require_loaded(connection)
    mismatched = await _count(
        connection,
        """
        SELECT count(*) FROM verse_word_alignments a
          JOIN verses v ON v.translation = a.translation AND v.verse_key = a.verse_key
         WHERE lower(substring(v.text FROM a.char_start + 1
                                     FOR a.char_end - a.char_start)) <> a.token
        """,
    )
    assert mismatched == 0


async def test_every_alignment_points_inside_its_own_verse(
    connection: asyncpg.Connection,
) -> None:
    await _require_loaded(connection)
    assert not await _count(
        connection,
        """
        SELECT count(*) FROM verse_word_alignments a
          JOIN verse_words w ON w.id = a.verse_word_id
         WHERE w.verse_key <> a.verse_key
        """,
    )


async def test_usage_counts_agree_with_the_words_they_summarise(
    connection: asyncpg.Connection,
) -> None:
    """The stat strip is pre-computed (AI-07). Pre-computed must not mean stale.

    Counted under `simple_strongs`, which is the number the badge prints. The
    join key is the whole point: keyed on the disambiguated sense instead, this
    aggregate agreed with itself and still told the reader that Ἰησοῦς occurs
    once in the New Testament.
    """
    await _require_loaded(connection)
    disagreements = await _count(
        connection,
        """
        SELECT count(*) FROM lexicon_usage u
          JOIN (SELECT l.simple_strongs AS number,
                       count(*) AS n,
                       count(DISTINCT w.verse_key) AS v
                  FROM verse_words w
                  JOIN lexicon l ON l.strongs = w.strongs
                 GROUP BY l.simple_strongs) actual
            ON actual.number = u.simple_strongs
         WHERE actual.n <> u.occurrence_count OR actual.v <> u.verse_count
        """,
    )
    assert disagreements == 0


async def test_no_published_strongs_number_is_counted_as_rarer_than_it_is(
    connection: asyncpg.Connection,
) -> None:
    """Pillar 3, at the row the badge reads.

    A Root badge prints `simple_strongs` beside `occurrence_count` and says in
    words how rare the word is. If any published number's stored count is below
    the number of word rows that publish it, some badge asserts a frequency a
    concordance contradicts -- which is what G2424 (992 occurrences, counted as
    1) did in Colossians 4:11.
    """
    await _require_loaded(connection)
    understated = await _count(
        connection,
        """
        SELECT count(*)
          FROM (SELECT l.simple_strongs AS number, count(*) AS occurrences
                  FROM verse_words w
                  JOIN lexicon l ON l.strongs = w.strongs
                 GROUP BY l.simple_strongs) actual
          LEFT JOIN lexicon_usage u ON u.simple_strongs = actual.number
         WHERE u.occurrence_count IS NULL
            OR u.occurrence_count < actual.occurrences
        """,
    )
    assert understated == 0


async def test_the_old_testament_has_no_word_anchors(
    connection: asyncpg.Connection,
) -> None:
    """An honest negative. TAHOT (the Hebrew word layer) was never acquired, so
    the Root badge cannot render on an Old Testament word. If this ever starts
    failing, TAHOT has landed and the badge's reach doubled."""
    await _require_loaded(connection)
    assert not await _count(
        connection, "SELECT count(*) FROM verse_words WHERE verse_key < 40000000"
    )
