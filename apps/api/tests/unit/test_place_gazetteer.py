"""The gazetteer: a name in, a coordinate out, and nothing invented.

This is the component that lets CLAUDE.md's rule hold -- "Never let a model
emit coordinates. Measured mean error was 41 km". A model emits a name; these
tests pin down what happens to it, including the case where the answer is
"I do not know", which must stay an answer and not become a guess.
"""

from __future__ import annotations

from scripts.place_gazetteer import (
    GazetteerEntry,
    NameLink,
    PlaceGazetteer,
    normalise_place_name,
)

PHILIPPI = GazetteerEntry(
    place_id="a49e1d0",
    name="Philippi",
    lat=41.012072,
    lng=24.284576,
    confidence=1.0,
    candidate_count=1,
    feature_type="settlement",
)
ANTIOCH_SYRIA = GazetteerEntry(
    place_id="a0000s",
    name="Antioch",
    lat=36.2,
    lng=36.16,
    confidence=1.0,
    candidate_count=1,
    feature_type="settlement",
)
ANTIOCH_PISIDIA = GazetteerEntry(
    place_id="a0000p",
    name="Antioch",
    lat=38.3,
    lng=31.19,
    confidence=0.9,
    candidate_count=2,
    feature_type="settlement",
)


def _gazetteer() -> PlaceGazetteer:
    return PlaceGazetteer.from_rows(
        [PHILIPPI, ANTIOCH_SYRIA, ANTIOCH_PISIDIA],
        [
            NameLink("philippi", "a49e1d0", 1_000_000),
            NameLink("antioch", "a0000s", 1_000_000),
            NameLink("antioch", "a0000p", 900),
        ],
    )


def test_normalisation_folds_case_punctuation_and_accents() -> None:
    assert normalise_place_name("Beth-shān") == normalise_place_name("Beth Shan")


def test_normalisation_drops_a_leading_article() -> None:
    """OpenBible files the article in its own column; a reader types it."""
    assert normalise_place_name("the Great Sea") == normalise_place_name("Great Sea")


def test_a_known_name_resolves_to_its_coordinate() -> None:
    assert _gazetteer().coordinates("Philippi") == (41.012072, 24.284576)


def test_resolution_is_case_and_whitespace_insensitive() -> None:
    assert _gazetteer().resolve("  PHILIPPI ") is not None


def test_an_unknown_name_resolves_to_nothing() -> None:
    """None is the answer. There is no fuzzy fallback: a near-miss on a
    transliterated name is how Ramah becomes Ramoth, 60 km away."""
    assert _gazetteer().resolve("Rivendell") is None
    assert _gazetteer().coordinates("Rivendell") is None


def test_a_near_miss_does_not_resolve() -> None:
    assert _gazetteer().resolve("Philippians") is None


def test_an_ambiguous_name_reports_every_candidate() -> None:
    """There really are two Antiochs. Hiding one is the collapse DECISIONS #10
    forbids."""
    hit = _gazetteer().resolve("Antioch")

    assert hit is not None
    assert hit.is_ambiguous is True
    assert hit.entry.place_id == "a0000s"
    assert [alternative.place_id for alternative in hit.alternatives] == ["a0000p"]


def test_an_unambiguous_name_reports_no_alternatives() -> None:
    hit = _gazetteer().resolve("Philippi")

    assert hit is not None
    assert hit.is_ambiguous is False


def test_a_name_pointing_at_an_unlocated_place_is_dropped() -> None:
    """Only located places are indexed, so resolve() can never return a hit
    without a coordinate."""
    gazetteer = PlaceGazetteer.from_rows(
        [PHILIPPI], [NameLink("philippi", "a49e1d0", 1), NameLink("nowhere", "a999", 1)]
    )

    assert gazetteer.resolve("nowhere") is None
    assert gazetteer.name_count == 1


def test_the_index_reports_its_own_size() -> None:
    gazetteer = _gazetteer()

    assert gazetteer.place_count == 3
    assert gazetteer.name_count == 2
    assert gazetteer.entry("a49e1d0") == PHILIPPI
