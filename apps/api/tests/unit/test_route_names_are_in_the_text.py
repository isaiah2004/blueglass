"""The Route badge's one invariant: every name it lists, the chapter spells.

The sheet says "N places named in this chapter · Listed in the order this
chapter names them". That is a checkable sentence, and over all 682 derived
routes it was false 752 times in 5,083 -- Greece in Acts 16, Alexandria in
Acts 27, "Moreh 1" and "Negeb" in Genesis 12, "Bethlehem 1" in Ruth 1.

Three causes, one per test class below, each reproduced from the real row that
produced it. `tests/integration/test_route_names_live.py` runs the same
invariant against real Postgres and the whole canon.
"""

from __future__ import annotations

import re
import unicodedata
from typing import ClassVar

import pytest

from app.modules.badges.domain import (
    ChapterBadgeData,
    PlaceMentionRecord,
    PlaceRecord,
    RouteRecord,
    RouteStopRecord,
    SourceAttribution,
    VerseText,
    build_route_badges,
)
from tests.gazetteer_doubles import published

GAZETTEER = SourceAttribution(
    key="openbible_geocoding",
    name="OpenBible.info Bible Geocoding Data",
    licence="CC-BY-4.0",
    attribution="Place data (c) OpenBible.info, CC BY 4.0",
    share_alike=False,
)


def _place(place_id: str, name: str, lng: float, lat: float, *spellings: str) -> PlaceRecord:
    """A located place. `spellings` are extra published forms beyond the name."""
    return PlaceRecord(
        place_id=place_id,
        name=name,
        modern_name=None,
        lat=lat,
        lng=lng,
        feature_type="settlement",
        named_verse_count=4,
        candidate_count=1,
        precision_type="site",
        source_key=GAZETTEER.key,
        spellings=published(name, *spellings),
    )


def _verse(verse_key: int, verse: int, text: str) -> VerseText:
    return VerseText(verse_key=verse_key, verse=verse, osis_id=f"Acts.16.{verse}", text=text)


def _chapter(
    verses: tuple[VerseText, ...],
    places: dict[str, PlaceRecord],
    stops: tuple[RouteStopRecord, ...],
    referred_to: frozenset[tuple[int, str]] = frozenset(),
) -> ChapterBadgeData:
    """One chapter carrying one chapter-scheme route.

    Every stop also gets the `place_mentions` row the repository would load for
    it, because that is what the live pipeline hands the builder. `referred_to`
    names the (verse, place) pairs whose mention kind is NOT `name` -- the
    gazetteer recording that the verse points at the place without spelling it.
    """
    return ChapterBadgeData(
        translation="BSB",
        book_number=44,
        chapter=16,
        verses=verses,
        sources={GAZETTEER.key: GAZETTEER},
        places=places,
        mentions=tuple(
            PlaceMentionRecord(
                verse_key=stop.verse_key,
                place_id=stop.place_id,
                mention_kind=(
                    "no_translation"
                    if (stop.verse_key, stop.place_id) in referred_to
                    else "name"
                ),
            )
            for stop in stops
        ),
        routes=(
            RouteRecord(
                route_id="chapter:Acts.16",
                scheme="chapter",
                start_key=stops[0].verse_key,
                end_key=stops[-1].verse_key,
                source_key=GAZETTEER.key,
                stops=stops,
            ),
        ),
    )


def _listed(data: ChapterBadgeData) -> list[str]:
    """The names the badge would print, or [] when it declines to build one."""
    badges = build_route_badges(data)
    return [] if not badges else [point.name for point in badges[0].payload.waypoints]


def _fold(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _names_in(text: str, name: str) -> bool:
    """Does `text` spell `name`, on word boundaries, accent- and case-blind?

    Deliberately reimplemented rather than imported: a test that reuses the
    matcher under test proves the matcher agrees with itself and nothing else.
    """
    return re.search(rf"(?<!\w){re.escape(_fold(name))}(?!\w)", _fold(text)) is not None


class TestAPlaceTheChapterNeverSpells:
    """Acts 16:9, verbatim, and the mention OpenBible records against it.

    `instance_types` there is `{"name": 1, "no_translation": 9}` -- nine of the
    ten translations OpenBible surveys refer to Greece without naming it, and
    the BSB is one of the nine. The badge listed it as a place named in the
    chapter for two rounds.
    """

    ACTS_16_9 = _verse(
        44016009,
        9,
        "During the night, Paul had a vision of a man of Macedonia standing and "
        "pleading with him, “Come over to Macedonia and help us.”",
    )
    ACTS_16_10 = _verse(
        44016010,
        10,
        "As soon as Paul had seen the vision, we got ready to leave for Macedonia,"
        " concluding that God had called us to preach the gospel to them.",
    )
    PLACES: ClassVar[dict[str, PlaceRecord]] = {
        "greece": _place("greece", "Greece", 21.8, 39.1, "Grecia", "Javan", "Greeks"),
        "macedonia": _place("macedonia", "Macedonia", 22.0, 41.0),
        "philippi": _place("philippi", "Philippi", 24.28, 41.01),
    }

    STOPS = (
        RouteStopRecord(position=1, verse_key=44016009, place_id="macedonia"),
        RouteStopRecord(position=2, verse_key=44016009, place_id="greece"),
        RouteStopRecord(position=3, verse_key=44016010, place_id="philippi"),
    )
    REFERRED_TO = frozenset({(44016009, "greece")})

    def test_it_is_not_listed_when_the_gazetteer_says_it_is_unnamed(self) -> None:
        """Gate one: the mention kind. It is why Greece never reaches the text."""
        data = _chapter(
            (self.ACTS_16_9, self.ACTS_16_10), self.PLACES, self.STOPS, self.REFERRED_TO
        )

        assert "Greece" not in _listed(data)

    def test_it_is_not_listed_even_when_the_kind_says_name(self) -> None:
        """Gate two, alone: the verse does not contain the word, and that decides it."""
        data = _chapter((self.ACTS_16_9, self.ACTS_16_10), self.PLACES, self.STOPS)

        assert "Greece" not in _listed(data)

    def test_the_badge_is_withheld_when_too_few_places_survive(self) -> None:
        """Pillar 3 over completeness: one verifiable pin is not a route."""
        data = _chapter(
            (self.ACTS_16_9,),
            self.PLACES,
            (
                RouteStopRecord(position=1, verse_key=44016009, place_id="macedonia"),
                RouteStopRecord(position=2, verse_key=44016009, place_id="greece"),
            ),
            self.REFERRED_TO,
        )

        assert build_route_badges(data) == []


class TestTheGazetteerHeadwordIsNotAlwaysASpelling:
    """`places.name` is an index key, and no chapter is obliged to contain it.

    315 of 1,342 places carried a homonym ordinal ("Bethlehem 1"), and others
    prefer a transliteration the reader will not see: Genesis 12:9 is "toward
    the Negev" while the headword is "Negeb".
    """

    GEN_12_9 = _verse(1012009, 9, "And Abram journeyed on toward the Negev.")
    GEN_12_6 = _verse(
        1012006,
        6,
        "Abram traveled through the land as far as the site of the Oak of Moreh"
        " at Shechem. And at that time the Canaanites were in the land.",
    )
    PLACES: ClassVar[dict[str, PlaceRecord]] = {
        "negeb": _place("negeb", "Negeb", 34.9, 31.0, "Negev", "South"),
        "moreh": _place("moreh", "Moreh 1", 35.28, 32.21, "Moreh", "Oak of Moreh"),
    }
    STOPS = (
        RouteStopRecord(position=1, verse_key=1012006, place_id="moreh"),
        RouteStopRecord(position=2, verse_key=1012009, place_id="negeb"),
    )

    def test_the_waypoint_carries_the_words_the_verse_uses(self) -> None:
        listed = _listed(_chapter((self.GEN_12_6, self.GEN_12_9), self.PLACES, self.STOPS))

        assert listed == ["Oak of Moreh", "Negev"]

    def test_no_listed_name_carries_a_homonym_ordinal(self) -> None:
        listed = _listed(_chapter((self.GEN_12_6, self.GEN_12_9), self.PLACES, self.STOPS))

        assert not [name for name in listed if re.search(r"\s\d+$", name)]

    def test_a_lower_case_common_word_is_not_a_name(self) -> None:
        """ "South" is a published spelling of Negeb. "the south" is a direction."""
        verse = _verse(1012009, 9, "And Abram journeyed on still toward the south.")
        data = _chapter((self.GEN_12_6, verse), self.PLACES, self.STOPS)

        assert "South" not in _listed(data)
        assert "south" not in _listed(data)


class TestTheVerseThatGetsToSayIt:
    """A stop the text fails does not use the place up."""

    EARLY = _verse(44016011, 11, "We sailed from Troas and made a straight run.")
    LATER = _verse(44016012, 12, "From there we went to Philippi, a Roman colony.")
    PLACES: ClassVar[dict[str, PlaceRecord]] = {
        "troas": _place("troas", "Troas", 26.16, 39.75),
        "philippi": _place("philippi", "Philippi", 24.28, 41.01),
    }
    STOPS: ClassVar[tuple[RouteStopRecord, ...]] = (
        RouteStopRecord(position=1, verse_key=44016011, place_id="troas"),
        RouteStopRecord(position=2, verse_key=44016011, place_id="philippi"),
        RouteStopRecord(position=3, verse_key=44016012, place_id="philippi"),
    )

    def test_a_later_verse_that_does_name_it_still_lists_it(self) -> None:
        data = _chapter((self.EARLY, self.LATER), self.PLACES, self.STOPS)
        badge = build_route_badges(data)[0]

        assert [point.name for point in badge.payload.waypoints] == ["Troas", "Philippi"]
        philippi = badge.payload.waypoints[1]
        assert philippi.verse_key == 44016012


_Named = TestAPlaceTheChapterNeverSpells
_Headword = TestTheGazetteerHeadwordIsNotAlwaysASpelling
_Later = TestTheVerseThatGetsToSayIt

#: One entry per cause above, so the invariant is checked over all three.
CASES = {
    "acts16-fragment": _chapter(
        (_Named.ACTS_16_9, _Named.ACTS_16_10), _Named.PLACES, _Named.STOPS, _Named.REFERRED_TO
    ),
    "genesis12-fragment": _chapter(
        (_Headword.GEN_12_6, _Headword.GEN_12_9), _Headword.PLACES, _Headword.STOPS
    ),
    "acts16-11-12": _chapter((_Later.EARLY, _Later.LATER), _Later.PLACES, _Later.STOPS),
}


class TestTheInvariantItself:
    """The sentence on the sheet, checked as a sentence, over every fixture."""

    @pytest.mark.parametrize("data", CASES.values(), ids=CASES.keys())
    def test_every_listed_name_occurs_in_the_chapter_text(
        self, data: ChapterBadgeData
    ) -> None:
        chapter_text = " ".join(verse.text for verse in data.verses)

        unsupported = [name for name in _listed(data) if not _names_in(chapter_text, name)]

        assert unsupported == []

    @pytest.mark.parametrize("data", CASES.values(), ids=CASES.keys())
    def test_every_listed_name_occurs_in_the_verse_it_cites(
        self, data: ChapterBadgeData
    ) -> None:
        """The list prints a verse beside each place. That has to be true too.

        Over every badge the case produces, which for the Acts 16 fragment is
        none: two of its three stops are unverifiable, and one pin is not a route.
        """
        for badge in build_route_badges(data):
            for point in badge.payload.waypoints:
                verse = data.verse_text(point.verse_key)
                assert verse is not None
                assert _names_in(verse.text, point.name)
