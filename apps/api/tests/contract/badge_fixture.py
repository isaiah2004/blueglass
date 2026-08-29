"""The Acts 16 fixture chapter every badge contract test runs against.

Purpose
    One chapter of hand-built rows that between them justify all five badge
    kinds, so every endpoint -- success and every documented failure code --
    can be exercised in milliseconds with no database. `badge_doubles.py`
    serves it through the repository port; nothing here knows about HTTP.

Why the rows are module constants rather than one builder
    They were one 93-line `fixture_chapter`, which broke rule 5.4.3's 50-line
    cap. Split by badge input, each group can also be imported on its own by a
    test that wants to assert against one kind without building a chapter.

Three verses, chosen not convenient
    Between them they exercise all five kinds: a route across three located
    places, two settlements, a dated passage carrying Murai's reading, a
    once-occurring Greek lemma, and a strongly-voted cross-reference. Offsets
    are located with `str.index` rather than hard-coded, so a typo in the
    fixture text cannot silently become an off-by-one the tests then enshrine.
"""

from __future__ import annotations

from datetime import date

from app.modules.badges.domain import (
    AlignedWordRecord,
    ChapterBadgeData,
    CrossRefRecord,
    DatedPassageRecord,
    EventRecord,
    InterpretiveClaim,
    LexemeRecord,
    PlaceMentionRecord,
    PlaceRecord,
    RouteRecord,
    RouteStopRecord,
    RulerRecord,
    SourceAttribution,
    VerseText,
)
from tests.gazetteer_doubles import published

BOOK_ACTS = 44
CHAPTER = 16

#: A chapter that exists and has no enrichment at all -- the common case across
#: the canon today, and the one that must answer 200 with an empty list.
BARE_CHAPTER = 17

VERSE_1 = 44016001
VERSE_8 = 44016008
VERSE_14 = 44016014

TEXT_1 = "Paul came to Derbe and then to Lystra, where he found a disciple named Timothy."
#: The trailing "by the sea" is load-bearing: it gives verse 8 a last word
#: that is NOT a place name, so the verse-level Cross-Ref anchor and the
#: gazetteer anchor for Troas do not collide and both kinds get exercised.
TEXT_8 = "So they passed by Mysia and went down to Troas by the sea."
TEXT_14 = (
    "Among those listening was a woman named Lydia, a dealer in purple cloth "
    "from the city of Thyatira."
)

PURPLE_START = TEXT_14.index("purple")
PURPLE_END = PURPLE_START + len("purple")

GAZETTEER = "openbible_geocoding"
XREF = "openbible_xref"
DATING = "theographic_events"
RULERS = "wikidata_rulers"
MURAI = "murai_literary_structure"
LEXICON = "stepbible_tbesg"
GREEK_TEXT = "stepbible_tagnt"
ALIGNMENT = "atlas_gloss_alignment"


def _source(key: str, licence: str, *, share_alike: bool = False) -> SourceAttribution:
    return SourceAttribution(
        key=key,
        name=f"{key} dataset",
        licence=licence,
        attribution=f"{key}, {licence}",
        share_alike=share_alike,
        url=f"https://example.invalid/{key}",
        version="1",
        retrieved_at=date(2026, 8, 28),
    )


SOURCES: dict[str, SourceAttribution] = {
    GAZETTEER: _source(GAZETTEER, "CC-BY-4.0"),
    XREF: _source(XREF, "CC-BY-4.0"),
    DATING: _source(DATING, "CC-BY-SA-4.0", share_alike=True),
    RULERS: _source(RULERS, "CC0-1.0"),
    MURAI: _source(MURAI, "CC-BY-4.0"),
    LEXICON: _source(LEXICON, "CC-BY-4.0"),
    GREEK_TEXT: _source(GREEK_TEXT, "CC-BY-4.0"),
    ALIGNMENT: _source(ALIGNMENT, "CC-BY-4.0"),
}


def _place(
    place_id: str,
    name: str,
    lng: float,
    lat: float,
    feature_type: str,
    *,
    named_verse_count: int = 10,
    candidates: int = 1,
) -> PlaceRecord:
    return PlaceRecord(
        place_id=place_id,
        name=name,
        modern_name=f"{name} Hoyuk",
        lat=lat,
        lng=lng,
        feature_type=feature_type,
        named_verse_count=named_verse_count,
        candidate_count=candidates,
        precision_type="site",
        source_key=GAZETTEER,
        spellings=published(name),
    )


PLACES: dict[str, PlaceRecord] = {
    "derbe": _place("derbe", "Derbe", 33.36, 37.35, "settlement", candidates=3),
    "mysia": _place("mysia", "Mysia", 28.5, 40.0, "region"),
    "troas": _place("troas", "Troas", 26.16, 39.75, "settlement", named_verse_count=6),
    "thyatira": _place(
        "thyatira", "Thyatira", 27.84, 38.92, "settlement", named_verse_count=4
    ),
}

_LYDIA_LEXEME = LexemeRecord(
    strongs="G4211",
    simple_strongs="G4211",
    lang="greek",
    lemma="πορφυρόπωλις",
    translit="porphyropolis",
    pos="G:N-F",
    short_gloss="dealer in purple",
    definition="A seller of purple cloth or garments.",
    occurrence_count=1,
    verse_count=1,
    book_count=1,
    source_key=LEXICON,
    definition_source_key=LEXICON,
)


#: The three verses, in reading order. Everything below anchors into these.
VERSES: tuple[VerseText, ...] = (
    VerseText(VERSE_1, 1, "Acts.16.1", TEXT_1),
    VerseText(VERSE_8, 8, "Acts.16.8", TEXT_8),
    VerseText(VERSE_14, 14, "Acts.16.14", TEXT_14),
)

#: Every located place name in those verses -- four mentions across three verses.
MENTIONS: tuple[PlaceMentionRecord, ...] = (
    PlaceMentionRecord(VERSE_1, "derbe", "name"),
    PlaceMentionRecord(VERSE_8, "mysia", "name"),
    PlaceMentionRecord(VERSE_8, "troas", "name"),
    PlaceMentionRecord(VERSE_14, "thyatira", "name"),
)

#: The one chapter-scheme route `[Route]` is built from, stopping at all four.
ROUTES: tuple[RouteRecord, ...] = (
    RouteRecord(
        route_id="chapter:Acts.16",
        scheme="chapter",
        start_key=VERSE_1,
        end_key=VERSE_14,
        source_key=GAZETTEER,
        stops=(
            RouteStopRecord(1, VERSE_1, "derbe"),
            RouteStopRecord(2, VERSE_8, "mysia"),
            RouteStopRecord(3, VERSE_8, "troas"),
            RouteStopRecord(4, VERSE_14, "thyatira"),
        ),
    ),
)

#: Murai's reading of the passage, carrying the interpretive claim `Q-015` attaches
#: to it. `[History]` is built from this plus the event and the reign below.
DATED_PASSAGES: tuple[DatedPassageRecord, ...] = (
    DatedPassageRecord(
        passage_id="murai:044016001-044016014",
        start_key=VERSE_1,
        end_key=VERSE_14,
        title="Timothy joins Paul and Silas",
        year_approx=47,
        year_label="AD 47",
        rationale="Dated from the Theographic event, which narrates most of it.",
        confidence=0.6,
        origin="sourced",
        source_key=DATING,
        claim=InterpretiveClaim(
            attributed_to="Hajime Murai",
            claim_label="Murai's reading",
            claim_type="interpretive",
            source_key=MURAI,
        ),
    ),
)

#: The Theographic event the dating above is derived from.
EVENTS: tuple[EventRecord, ...] = (
    EventRecord(
        1,
        "Timothy Joins Paul and Silas",
        47,
        "AD 47",
        VERSE_1,
        VERSE_8,
        "Second Missionary Journey",
        DATING,
    ),
)

#: Claudius, on the throne for the whole passage. Named for its record type
#: because `RULERS` is already taken by the source key these rows cite.
RULER_RECORDS: tuple[RulerRecord, ...] = (
    RulerRecord(1, "Claudius", "Roman Empire", "Emperor", 41, 54, RULERS),
)

#: The single aligned Greek word `[Root]` is built from.
WORDS: tuple[AlignedWordRecord, ...] = (
    AlignedWordRecord(
        verse_key=VERSE_14,
        token_index=11,
        token="purple",
        char_start=PURPLE_START,
        char_end=PURPLE_END,
        method="gloss-exact",
        confidence=1.0,
        surface="πορφυρόπωλις",
        lexeme=_LYDIA_LEXEME,
        source_key=ALIGNMENT,
        word_source_key=GREEK_TEXT,
    ),
)

#: Three strongly-voted links and one below MIN_VOTES. The weak one is present so
#: a test can prove weak links are dropped rather than merely not selected.
CROSS_REFS: tuple[CrossRefRecord, ...] = (
    CrossRefRecord(VERSE_8, 47002012, 47002013, 31, "2 Corinthians 2:12-13", None, XREF),
    CrossRefRecord(VERSE_14, 45016001, 45016001, 26, "Romans 16:1", "I commend", XREF),
    CrossRefRecord(VERSE_14, 66002018, 66002018, 12, "Revelation 2:18", None, XREF),
    CrossRefRecord(VERSE_1, 55001005, 55001005, 8, "2 Timothy 1:5", None, XREF),
)


def fixture_chapter(translation: str = "BSB") -> ChapterBadgeData:
    """The three-verse Acts 16 every contract test runs against.

    The rows themselves are the module constants above, one per badge input.
    Assembling them here rather than inline keeps this under rule 5.4.3's
    50-line cap, and lets a test import one group without building a chapter.
    """
    return ChapterBadgeData(
        translation=translation,
        book_number=BOOK_ACTS,
        chapter=CHAPTER,
        verses=VERSES,
        sources=dict(SOURCES),
        places=dict(PLACES),
        mentions=MENTIONS,
        routes=ROUTES,
        dated_passages=DATED_PASSAGES,
        events=EVENTS,
        rulers=RULER_RECORDS,
        words=WORDS,
        cross_refs=CROSS_REFS,
    )
