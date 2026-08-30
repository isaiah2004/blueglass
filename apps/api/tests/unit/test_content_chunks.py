"""Unit tests for scripts.content_chunks: the embedding chunk boundary.

Purpose
    Prove the chunker never splits a verse, always returns whole verses in
    order, and only starts a new chunk once the budget is actually exceeded --
    the same exhaustive, pure-function style test_defect_3_relevance_scores.py
    uses for the read-side scoring maths.
"""

from __future__ import annotations

from scripts.content_chunks import Chunk, VerseText, chunk_passage


def test_empty_input_yields_no_chunks() -> None:
    assert chunk_passage([]) == []


def test_one_short_verse_is_one_chunk() -> None:
    verses = [VerseText(verse_key=44001001, text="Paul went to Antioch.")]
    chunks = chunk_passage(verses)
    assert chunks == [
        Chunk(chunk_index=0, verse_key=44001001, content="Paul went to Antioch.")
    ]


def test_several_short_verses_stay_in_one_chunk() -> None:
    verses = [
        VerseText(verse_key=44001001, text="Verse one."),
        VerseText(verse_key=44001002, text="Verse two."),
        VerseText(verse_key=44001003, text="Verse three."),
    ]
    chunks = chunk_passage(verses)
    assert len(chunks) == 1
    assert chunks[0].content == "Verse one. Verse two. Verse three."
    assert chunks[0].verse_key == 44001001
    assert chunks[0].chunk_index == 0


def test_verses_are_joined_with_a_single_space() -> None:
    verses = [
        VerseText(verse_key=1, text="A"),
        VerseText(verse_key=2, text="B"),
    ]
    assert chunk_passage(verses)[0].content == "A B"


def test_a_long_run_of_verses_splits_into_multiple_chunks() -> None:
    # Each verse is 100 chars; a 250-char budget must force a new chunk
    # before a third verse would push the running total over budget.
    verses = [VerseText(verse_key=i, text="x" * 100) for i in range(1, 4)]
    chunks = chunk_passage(verses, max_chars=250)
    assert len(chunks) == 2
    assert chunks[0].chunk_index == 0
    assert chunks[1].chunk_index == 1
    # No verse's text is lost or duplicated across the split.
    assert "".join(c.content.replace(" ", "") for c in chunks) == "x" * 300


def test_split_chunks_start_at_the_right_verse() -> None:
    verses = [VerseText(verse_key=i, text="x" * 100) for i in range(1, 4)]
    chunks = chunk_passage(verses, max_chars=250)
    assert chunks[0].verse_key == 1
    assert chunks[1].verse_key == 3


def test_a_single_verse_over_budget_is_its_own_chunk_not_truncated() -> None:
    # Truncating would make the embedding describe less than its own
    # citation -- worse than one oversized request.
    oversized = VerseText(verse_key=1, text="x" * 5000)
    chunks = chunk_passage([oversized], max_chars=2000)
    assert len(chunks) == 1
    assert chunks[0].content == "x" * 5000


def test_an_oversized_verse_still_starts_a_fresh_chunk_after_it() -> None:
    verses = [
        VerseText(verse_key=1, text="x" * 5000),
        VerseText(verse_key=2, text="short"),
    ]
    chunks = chunk_passage(verses, max_chars=2000)
    assert len(chunks) == 2
    assert chunks[1].content == "short"
    assert chunks[1].verse_key == 2


def test_chunk_indexes_are_sequential_from_zero() -> None:
    verses = [VerseText(verse_key=i, text="x" * 100) for i in range(1, 6)]
    chunks = chunk_passage(verses, max_chars=150)
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))
