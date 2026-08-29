"""Turn asyncpg rows into badge domain records. Mapping only, no rules.

Purpose
    Rule 5.1: an adapter translates, it does not decide. Every judgement about
    what a badge is worth, which words qualify, or how many survive lives in
    `domain/`; this module only says which column becomes which field.

The one thing that is computed here
    `display_reference` -- "Rom 8:1-4" -- because rendering a verse key as a
    human reference needs the book table, which is the scripture domain's, and
    doing it once at the boundary is cheaper than shipping the raw keys and
    having every client reimplement it. It is presentation of a datum, not a
    claim about one.

Dependencies
    asyncpg records, the scripture domain's book table, the badge domain.
"""

from __future__ import annotations

from collections.abc import Mapping

import asyncpg

from ...scripture.domain import BY_NUMBER, split_verse_key
from ..domain import (
    AlignedWordRecord,
    CrossRefRecord,
    DatedPassageRecord,
    EventRecord,
    InterpretiveClaim,
    LexemeRecord,
    PlaceMentionRecord,
    PlaceRecord,
    RulerRecord,
    SourceAttribution,
    VerseText,
)
from ..domain.place_spelling import PlaceSpelling, normalise_name


def to_verse(row: asyncpg.Record) -> VerseText:
    """One verse of the chapter."""
    return VerseText(
        verse_key=row["verse_key"],
        verse=row["verse"],
        osis_id=row["osis_id"],
        text=row["text"],
    )


def to_source(row: asyncpg.Record) -> SourceAttribution:
    """One provenance row. `license` on the wire, `licence` in the domain."""
    return SourceAttribution(
        key=row["key"],
        name=row["name"],
        licence=row["license"],
        attribution=row["attribution"],
        share_alike=row["share_alike"],
        url=row["url"],
        version=row["version"],
        retrieved_at=row["retrieved_at"],
    )


def to_place(row: asyncpg.Record) -> PlaceRecord:
    """One gazetteer place, with every spelling the badge domain may weigh."""
    return PlaceRecord(
        place_id=row["place_id"],
        name=row["name"],
        modern_name=row["modern_name"],
        lat=row["lat"],
        lng=row["lng"],
        feature_type=row["feature_type"],
        named_verse_count=row["named_verse_count"],
        candidate_count=row["candidate_count"],
        homonym_count=row["homonym_count"],
        precision_type=row["precision_type"],
        source_key=row["source_key"],
        spellings=tuple(to_spelling(entry) for entry in (row["spellings"] or ())),
    )


def to_spelling(entry: Mapping[str, object]) -> PlaceSpelling:
    """One `place_names` row, as the domain's record.

    The stored `normalised` column was written by the loader's folding rule;
    folding it again here is a no-op for well-formed rows and a repair for any
    row written before that rule settled, so the anchor lookup cannot miss on a
    formatting difference alone.
    """
    return PlaceSpelling(
        normalised=normalise_name(str(entry["normalised"])),
        name=str(entry["name"]),
        kind=str(entry["kind"]),
        attestation=int(str(entry["attestation"])),
        names_another_place=bool(entry["names_another_place"]),
    )


def to_place_mention(row: asyncpg.Record) -> PlaceMentionRecord:
    """One place named in one verse."""
    return PlaceMentionRecord(
        verse_key=row["verse_key"],
        place_id=row["place_id"],
        mention_kind=row["mention_kind"],
    )


def to_dated_passage(row: asyncpg.Record) -> DatedPassageRecord:
    """One dated passage, with the scholar's reading attached when there is one."""
    return DatedPassageRecord(
        passage_id=row["passage_id"],
        start_key=row["start_key"],
        end_key=row["end_key"],
        title=row["title"],
        year_approx=row["year_approx"],
        year_label=row["year_label"],
        rationale=row["rationale"],
        confidence=_rounded(row["confidence"]),
        origin=row["origin"],
        source_key=row["source_key"],
        claim=_to_claim(row),
    )


def _rounded(value: float | None) -> float | None:
    """Trim a float4 to four places.

    `confidence` is a real, so 0.6 comes back as 0.6000000238418579. Publishing
    that implies sixteen digits of precision on a number the source expresses
    as a percentage, and it makes a response byte-unstable to look at.
    """
    return None if value is None else round(value, 4)


def _to_claim(row: asyncpg.Record) -> InterpretiveClaim | None:
    """The interpretive-claim half of a dated passage, or None.

    All four columns must be present. A claim label with no attributed scholar,
    or with no source, is exactly what Q-015 forbids rendering, so it is not
    assembled rather than being assembled and filtered later.
    """
    attributed_to = row["attributed_to"]
    claim_label = row["claim_label"]
    claim_source = row["claim_source_key"]
    if not (attributed_to and claim_label and claim_source):
        return None
    return InterpretiveClaim(
        attributed_to=attributed_to,
        claim_label=claim_label,
        claim_type=row["claim_type"] or "interpretive",
        source_key=claim_source,
    )


def to_event(row: asyncpg.Record) -> EventRecord:
    """One dated biblical event."""
    return EventRecord(
        event_id=row["id"],
        title=row["title"],
        year_approx=row["year_approx"],
        date_label=row["date_label"],
        start_key=row["start_key"],
        end_key=row["end_key"],
        part_of=row["part_of"],
        source_key=row["source_key"],
    )


def to_ruler(row: asyncpg.Record) -> RulerRecord:
    """One reign."""
    return RulerRecord(
        ruler_id=row["id"],
        name=row["name"],
        realm=row["realm"],
        title=row["title"],
        start_year=row["start_year"],
        end_year=row["end_year"],
        source_key=row["source_key"],
    )


def to_aligned_word(row: asyncpg.Record) -> AlignedWordRecord:
    """One English token and the original-language word it renders."""
    return AlignedWordRecord(
        verse_key=row["verse_key"],
        token_index=row["token_index"],
        token=row["token"],
        char_start=row["char_start"],
        char_end=row["char_end"],
        method=row["method"],
        confidence=row["confidence"],
        surface=row["surface"],
        lexeme=_to_lexeme(row),
        source_key=row["alignment_source_key"],
        word_source_key=row["word_source_key"],
    )


def _to_lexeme(row: asyncpg.Record) -> LexemeRecord:
    """The lexicon half of an aligned-word row."""
    return LexemeRecord(
        strongs=row["strongs"],
        simple_strongs=row["simple_strongs"],
        lang=row["lang"],
        lemma=row["lemma"],
        translit=row["translit"],
        pos=row["pos"],
        short_gloss=row["short_gloss"],
        definition=row["definition"],
        occurrence_count=row["occurrence_count"],
        verse_count=row["verse_count"],
        book_count=row["book_count"],
        source_key=row["lexeme_source_key"],
        definition_source_key=row["definition_source_key"],
    )


def to_cross_ref(row: asyncpg.Record) -> CrossRefRecord:
    """One outbound cross-reference, with a printable reference."""
    return CrossRefRecord(
        from_key=row["from_key"],
        to_start_key=row["to_start_key"],
        to_end_key=row["to_end_key"],
        votes=row["votes"],
        display_reference=display_reference(row["to_start_key"], row["to_end_key"]),
        text=row["text"],
        source_key=row["source_key"],
    )


def display_reference(start_key: int, end_key: int) -> str:
    """Render a verse span the way a reader writes it.

    Three shapes, because the source publishes all three: a single verse
    ("Rom 8:1"), a span inside one chapter ("Rom 8:1-4"), and a span crossing a
    chapter or a book ("Rom 8:1 - 9:5", "Rom 16:27 - 1 Cor 1:1").
    """
    start_book, start_chapter, start_verse = split_verse_key(start_key)
    end_book, end_chapter, end_verse = split_verse_key(end_key)
    head = f"{_book_name(start_book)} {start_chapter}:{start_verse}"
    if start_key == end_key:
        return head
    if start_book == end_book and start_chapter == end_chapter:
        return f"{head}-{end_verse}"
    if start_book == end_book:
        return f"{head} - {end_chapter}:{end_verse}"
    return f"{head} - {_book_name(end_book)} {end_chapter}:{end_verse}"


def _book_name(book_number: int) -> str:
    """A book's display name, or its number when it is outside the canon."""
    book = BY_NUMBER.get(book_number)
    return book.name if book is not None else str(book_number)
