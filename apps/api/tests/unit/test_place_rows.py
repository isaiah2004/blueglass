"""The two-file gazetteer join, on records transcribed from the real files.

The Philippi records below are copied from
data/raw/openbible-geocoding/PROVENANCE.md, which recorded them verbatim from
the retrieved bytes. The trap they exist to pin down: ancient.jsonl carries no
coordinates, and modern.jsonl's lonlat is LONGITUDE-first.
"""

from __future__ import annotations

import json

import pytest

from scripts.place_parser import clamp_confidence, parse_lonlat, parse_places
from scripts.place_rows import PlaceDataError

PHILIPPI_ANCIENT = {
    "id": "a49e1d0",
    "friendly_id": "Philippi",
    "url_slug": "philippi",
    "types": ["settlement"],
    "translation_name_counts": {"Philippi": 8},
    "modern_associations": {"mec5201": {"name": "Philippi", "score": 1000}},
    "verses": [
        {
            "osis": "Acts.16.12",
            "sort": "44016012",
            "instance_types": {"name": 10},
        }
    ],
}

PHILIPPI_MODERN = {
    "id": "mec5201",
    "friendly_id": "Philippi",
    "lonlat": "24.284576,41.012072",
    "precision": {"description": "point in visible remains", "meters": 5, "type": "visible"},
}


def _jsonl(*records: dict[str, object]) -> bytes:
    return "\n".join(json.dumps(record) for record in records).encode("utf-8")


def _philippi(**overrides: object) -> dict[str, object]:
    return {**PHILIPPI_ANCIENT, **overrides}


def test_lonlat_is_longitude_first() -> None:
    """Reading it the other way puts Philippi in the Indian Ocean."""
    assert parse_lonlat("24.284576,41.012072", "mec5201") == (41.012072, 24.284576)


def test_a_lonlat_outside_the_world_is_refused() -> None:
    with pytest.raises(PlaceDataError, match="outside the world"):
        parse_lonlat("24.0,910.0", "mec5201")


def test_an_unusable_lonlat_is_refused() -> None:
    with pytest.raises(PlaceDataError, match="unusable lonlat"):
        parse_lonlat(None, "mec5201")


def test_the_coordinate_arrives_from_the_other_file() -> None:
    dataset = parse_places(_jsonl(PHILIPPI_ANCIENT), _jsonl(PHILIPPI_MODERN))
    (place,) = dataset.places

    assert (place.lat, place.lng) == (41.012072, 24.284576)
    assert place.modern_name == "Philippi"
    assert place.precision_meters == 5
    assert place.precision_type == "visible"


def test_a_place_with_no_modern_match_stays_unlocated() -> None:
    """Seven of the 1,342 ancient places have no located candidate. They are
    kept -- a place named in scripture that nobody can map is still a fact."""
    dataset = parse_places(_jsonl(PHILIPPI_ANCIENT), _jsonl())
    (place,) = dataset.places

    assert place.lat is None
    assert place.lng is None
    assert place.is_located is False
    assert place.candidates == ()


def test_the_verse_key_comes_free_from_sort() -> None:
    dataset = parse_places(_jsonl(PHILIPPI_ANCIENT), _jsonl(PHILIPPI_MODERN))
    (mention,) = dataset.mentions

    assert mention.verse_key == 44_016_012
    assert mention.osis_id == "Acts.16.12"
    assert mention.mention_kind == "name"


def test_a_sort_that_disagrees_with_its_osis_id_is_refused() -> None:
    """The two agreeing on all 8,742 links is what makes the free key safe."""
    broken = _philippi(verses=[{"osis": "Acts.16.12", "sort": "44016013"}])

    with pytest.raises(PlaceDataError, match="disagrees with OSIS"):
        parse_places(_jsonl(broken), _jsonl(PHILIPPI_MODERN))


def test_rival_candidates_are_ranked_not_collapsed() -> None:
    """777 of 1,342 places have more than one candidate site. DECISIONS #10
    forbids collapsing that disagreement to a single pin."""
    rival = {**PHILIPPI_MODERN, "id": "mrival", "lonlat": "25.0,40.0"}
    ancient = _philippi(
        modern_associations={
            "mec5201": {"score": 1000},
            "mrival": {"score": 250},
        }
    )
    dataset = parse_places(_jsonl(ancient), _jsonl(PHILIPPI_MODERN, rival))
    (place,) = dataset.places

    assert [candidate.modern_id for candidate in place.candidates] == [
        "mec5201",
        "mrival",
    ]
    assert place.lat == 41.012072


def test_a_negative_score_clamps_to_no_confidence() -> None:
    """Two places have a best candidate below zero; six score above 1000."""
    assert clamp_confidence(-407) == 0.0
    assert clamp_confidence(1169) == 1.0
    assert clamp_confidence(500) == 0.5


def test_every_spelling_becomes_a_gazetteer_row() -> None:
    ancient = _philippi(translation_name_counts={"Philippi": 8, "Philippoi": 2})
    dataset = parse_places(_jsonl(ancient), _jsonl(PHILIPPI_MODERN))

    assert {row.normalised for row in dataset.names} == {"philippi", "philippoi"}


def test_the_published_name_outranks_its_own_variant() -> None:
    """Jerusalem's variant count is 7,819, which used to displace its primary."""
    ancient = _philippi(translation_name_counts={"Philippi": 9999})
    dataset = parse_places(_jsonl(ancient), _jsonl(PHILIPPI_MODERN))
    (row,) = [name for name in dataset.names if name.normalised == "philippi"]

    assert row.kind == "primary"


def test_the_dominant_mention_kind_wins() -> None:
    ancient = _philippi(
        verses=[
            {
                "osis": "Acts.16.12",
                "sort": "44016012",
                "instance_types": {"name": 2, "people_group": 9},
            }
        ]
    )
    dataset = parse_places(_jsonl(ancient), _jsonl(PHILIPPI_MODERN))

    assert dataset.mentions[0].mention_kind == "people_group"
