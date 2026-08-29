"""The row shapes the OpenBible gazetteer becomes, and nothing else.

Purpose
    Types only. Keeping the shapes apart from the parser means the loader, the
    route builder and the tests can all name a row without importing the file
    reader, and it keeps both modules inside the 300-line limit.

Key responsibilities
    Define one dataclass per destination table, plus the candidate list that
    keeps scholarly disagreement visible instead of collapsing it.

Dependencies
    Standard library only.

Usage
    from scripts.place_rows import PlaceRow, PlaceMentionRow
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

#: OpenBible's candidate score. 1000 means "certain"; the column is divided by
#: it to produce the 0..1 confidence the places table stores.
#:
#: The scale is NOT bounded by 1000. Measured range across the acquired file is
#: -407 to 1169: six places score above "certain" and two have a best candidate
#: below zero, meaning the identification is actively doubted. Both ends are
#: clamped, so confidence stays a fraction a UI can render as a bar -- and the
#: raw score survives untouched inside places.candidates, which is where a
#: reader who wants the disagreement itself can find it (DECISIONS #10).
CERTAIN_SCORE = 1000

#: Weight given to a place's own published name. Deliberately far above any
#: translation count -- the highest measured is Jerusalem's 7,819 -- so that a
#: place's canonical spelling always outranks a variant. At the old value of
#: 1,000 the five most-named places in the canon (Egypt, Jerusalem, Jordan,
#: Zion, Assyria) had their primary row displaced by their own variant row.
PRIMARY_NAME_WEIGHT = 1_000_000

#: The one mention kind whose place name appears verbatim in the English text.
#: Every count and every anchor a badge publishes is restricted to it; the
#: other six kinds (people_group, no_translation, common_noun, helper, partial,
#: person) mean the verse refers to the place some other way.
#: `badges.domain.builders.place_support.ANCHORABLE_MENTION` is the domain's
#: copy -- the loader may not import the domain, nor the domain the loader --
#: and `tests/unit/test_place_rows.py` pins the two together.
NAMED_MENTION_KIND = "name"

#: Used when a verse record carries no instance_types at all.
UNKNOWN_MENTION_KIND = NAMED_MENTION_KIND

#: Used when an ancient record carries no types. Never observed in the acquired
#: file (all 1,342 rows have at least one), but the column is NOT NULL.
UNKNOWN_FEATURE_TYPE = "unknown"


class PlaceDataError(RuntimeError):
    """The geocoding files are not shaped the way the loader requires."""


@dataclass(frozen=True, slots=True)
class ModernSite:
    """One modern identification -- the only place a coordinate exists."""

    modern_id: str
    name: str
    lat: float
    lng: float
    precision_meters: int | None
    precision_type: str | None


@dataclass(frozen=True, slots=True)
class Candidate:
    """One scholarly identification of an ancient place with a modern site."""

    modern_id: str
    name: str
    lat: float
    lng: float
    score: int

    def as_json(self) -> dict[str, Any]:
        """The shape stored in places.candidates."""
        return {
            "modern_id": self.modern_id,
            "name": self.name,
            "lat": self.lat,
            "lng": self.lng,
            "score": self.score,
        }


@dataclass(frozen=True, slots=True)
class PlaceRow:
    """One row destined for the places table.

    ``name`` is the label a reader sees and nothing else. OpenBible's homonym
    ordinal, which used to travel inside it as "Ramah 2", lives in
    ``disambiguation_index``; ``homonym_count`` says whether the label needs
    disambiguating at all, and ``disambiguation`` carries the source's own note
    when it published one. See place_disambiguation for why they were split.
    """

    place_id: str
    name: str
    slug: str
    modern_name: str | None
    lng: float | None
    lat: float | None
    feature_type: str
    feature_types: tuple[str, ...]
    confidence: float | None
    precision_meters: int | None
    precision_type: str | None
    candidates: tuple[Candidate, ...]
    named_verse_count: int
    disambiguation_index: int | None = None
    homonym_count: int = 1
    disambiguation: str | None = None

    @property
    def is_located(self) -> bool:
        """True when this place has a coordinate to draw."""
        return self.lat is not None

    @property
    def is_ambiguous(self) -> bool:
        """True when another place in the gazetteer carries the same name.

        A sheet that renders an ambiguous name without saying so is asserting
        an identification the data does not make (DECISIONS #10).
        """
        return self.homonym_count > 1


@dataclass(frozen=True, slots=True)
class PlaceNameRow:
    """One spelling in the gazetteer index."""

    normalised: str
    name: str
    place_id: str
    kind: str
    weight: int


@dataclass(frozen=True, slots=True)
class PlaceMentionRow:
    """One place named in one verse."""

    place_id: str
    verse_key: int
    osis_id: str
    mention_kind: str


@dataclass(frozen=True, slots=True)
class PlaceDataset:
    """Everything one parse of the two files produced."""

    places: tuple[PlaceRow, ...]
    names: tuple[PlaceNameRow, ...]
    mentions: tuple[PlaceMentionRow, ...]
