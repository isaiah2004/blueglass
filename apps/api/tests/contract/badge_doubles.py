"""An in-memory BadgeRepository, and the fixture chapter it serves.

Purpose
    Let every badge endpoint -- success and every documented failure code -- be
    tested in milliseconds with no database. The double exists because the port
    exists; a service that reached for asyncpg from its routes could not have
    one.

Fidelity
    This is a double, not a simulation. It implements `load_chapter` and
    nothing more. That the SQL behind the real adapter is valid, and that the
    Acts 16 it returns is the Acts 16 the datasets describe, is covered by
    `tests/integration/test_badges_live.py` against real Postgres.

The fixture chapter
    Three verses of Acts 16, chosen because between them they exercise all five
    badge kinds: a route across three located places, two settlements, a dated
    passage carrying Murai's reading, a once-occurring Greek lemma, and a
    strongly-voted cross-reference. Offsets are located with `str.index` rather
    than hard-coded, so a typo in the fixture text cannot silently become an
    off-by-one the tests then enshrine.
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
    verse_count: int = 10,
    candidates: int = 1,
) -> PlaceRecord:
    return PlaceRecord(
        place_id=place_id,
        name=name,
        modern_name=f"{name} Hoyuk",
        lat=lat,
        lng=lng,
        feature_type=feature_type,
        verse_count=verse_count,
        candidate_count=candidates,
        precision_type="site",
        source_key=GAZETTEER,
        spellings=frozenset({name.lower()}),
    )


PLACES: dict[str, PlaceRecord] = {
    "derbe": _place("derbe", "Derbe", 33.36, 37.35, "settlement", candidates=3),
    "mysia": _place("mysia", "Mysia", 28.5, 40.0, "region"),
    "troas": _place("troas", "Troas", 26.16, 39.75, "settlement", verse_count=6),
    "thyatira": _place("thyatira", "Thyatira", 27.84, 38.92, "settlement", verse_count=4),
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


def fixture_chapter(translation: str = "BSB") -> ChapterBadgeData:
    """The three-verse Acts 16 every contract test runs against."""
    return ChapterBadgeData(
        translation=translation,
        book_number=BOOK_ACTS,
        chapter=CHAPTER,
        verses=(
            VerseText(VERSE_1, 1, "Acts.16.1", TEXT_1),
            VerseText(VERSE_8, 8, "Acts.16.8", TEXT_8),
            VerseText(VERSE_14, 14, "Acts.16.14", TEXT_14),
        ),
        sources=dict(SOURCES),
        places=dict(PLACES),
        mentions=(
            PlaceMentionRecord(VERSE_1, "derbe", "name"),
            PlaceMentionRecord(VERSE_8, "mysia", "name"),
            PlaceMentionRecord(VERSE_8, "troas", "name"),
            PlaceMentionRecord(VERSE_14, "thyatira", "name"),
        ),
        routes=(
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
        ),
        dated_passages=(
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
        ),
        events=(
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
        ),
        rulers=(RulerRecord(1, "Claudius", "Roman Empire", "Emperor", 41, 54, RULERS),),
        words=(
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
        ),
        cross_refs=(
            CrossRefRecord(
                VERSE_8, 47002012, 47002013, 31, "2 Corinthians 2:12-13", None, XREF
            ),
            CrossRefRecord(VERSE_14, 45016001, 45016001, 26, "Romans 16:1", "I commend", XREF),
            CrossRefRecord(VERSE_14, 66002018, 66002018, 12, "Revelation 2:18", None, XREF),
            #: Below MIN_VOTES. Present so a test can prove weak links are
            #: dropped rather than merely not selected.
            CrossRefRecord(VERSE_1, 55001005, 55001005, 8, "2 Timothy 1:5", None, XREF),
        ),
    )


class InMemoryBadgeRepository:
    """Serves one fixture chapter and an empty aggregate for anything else."""

    def __init__(self) -> None:
        self.chapter = fixture_chapter()
        #: Every (translation, book, chapter) asked for, in order. Lets a test
        #: prove the endpoint issues exactly one load per request.
        self.calls: list[tuple[str, int, int]] = []

    async def load_chapter(
        self, *, translation: str, book_number: int, chapter: int
    ) -> ChapterBadgeData:
        self.calls.append((translation, book_number, chapter))
        if book_number == BOOK_ACTS and chapter == CHAPTER and translation == "BSB":
            return self.chapter
        if book_number == BOOK_ACTS and chapter == BARE_CHAPTER and translation == "BSB":
            return ChapterBadgeData(
                translation=translation,
                book_number=book_number,
                chapter=chapter,
                verses=(VerseText(44017001, 1, "Acts.17.1", "They passed through."),),
                sources=dict(SOURCES),
            )
        return ChapterBadgeData(
            translation=translation, book_number=book_number, chapter=chapter
        )
