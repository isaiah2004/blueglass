"""What each of the five sheets shows. One payload dataclass per badge kind.

Purpose
    A badge is two things: a mark in the text, and the content of the sheet it
    opens. `badge.py` types the first half; this module types the second, once
    per kind, so the sheet router cannot be handed the wrong shape.

Relationship to `packages/shared`
    These mirror the payload interfaces in `packages/shared/src/badges/`. Three
    departures the acquired data forced, recorded here rather than discovered
    by a client developer:

    1. `City3dPayload` carries no `reconstructionId`, `eraLabel` or `landmarks`.
       `dataset-validation.md` 4.3 is a confirmed negative: no openly-licensed
       3D reconstruction of any biblical city exists. Shipping those fields
       would mean inventing them, which AI-05 forbids. What ships instead is
       the sourced site record -- the pin, the modern identification, and how
       many identifications scholarship actually offers.
    2. `HistoryPayload` carries `rationale` and `interpretive_claim`. The date
       is derived from an event that narrates only part of the passage, and the
       passage title is Murai's reading; both facts must reach the reader.
    3. `RootPayload` carries `verse_count` and `book_count` beside
       `occurrence_count`, because `lexicon_usage` pre-computed all three and
       the mockup's stat strip prints all three.

Dependencies
    Standard library only. Rule 5.1.2.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

#: `[longitude, latitude]`, GeoJSON order. See `packages/shared/src/geo.ts` --
#: swapping them drops every pin in the wrong hemisphere.
GeoCoordinates = tuple[float, float]

#: What part a place plays in a journey.
LocationRole = Literal["departure", "waypoint", "island", "destination"]

#: Why two passages are linked. M2 emits only `parallel`: OpenBible publishes a
#: vote count, not a relation, and labelling an unlabelled link "fulfilment"
#: would be the badge inventing a claim.
CrossReferenceRelation = Literal["quotation", "allusion", "fulfilment", "parallel"]


@dataclass(frozen=True, slots=True)
class MappedLocation:
    """A named place with a pin, and the two ways that pin can be unsettled.

    DECISIONS #10 -- "a sheet showing one pin for a shared or disputed
    identification says the identification is shared" -- has two distinct
    cases, and a pin that carries only one of them is still presenting a guess
    as a fact:

    `candidate_count` is how many modern dig sites scholarship proposes for
    THIS place. 777 of the 1,342 ancient places have more than one.

    `shared_name_count` is how many different ancient places carry this same
    name. Nine are called Ramah, four Gilgal, three Babylon, and 1,153 of the
    4,399 route waypoints canon-wide are one of them. Before this field the
    label read "Ramah 2", which asserted an ordinal no manuscript contains;
    dropping the ordinal without adding this replaced a wrong signal with no
    signal, which reads as certainty.

    Both default to 1 -- one site, one place of that name -- so a payload built
    without them claims nothing rather than claiming a dispute.
    """

    name: str
    coordinates: GeoCoordinates
    role: LocationRole
    feature_type: str
    place_id: str
    verse_key: int
    shared_name_count: int = 1
    candidate_count: int = 1


@dataclass(frozen=True, slots=True)
class MapCamera:
    """Where the camera opens. Computed from the waypoints, never sourced."""

    center: GeoCoordinates
    zoom_level: float


@dataclass(frozen=True, slots=True)
class VerseRange:
    """A span of verses, both endpoints inclusive."""

    start_key: int
    end_key: int


@dataclass(frozen=True, slots=True)
class RoutePayload:
    """Sheet content for `[Route]` -- one journey across the map."""

    title: str
    waypoints: tuple[MappedLocation, ...]
    camera: MapCamera
    passage: VerseRange
    scheme: str


@dataclass(frozen=True, slots=True)
class City3dPayload:
    """Sheet content for `[3D City]` -- one site, as far as sources allow.

    `has_reconstruction` is False for every row M2 ships and is present anyway:
    it is the interface a commissioned model drops into later, and a client
    that branches on it today needs no change when one arrives.
    """

    location: MappedLocation
    modern_name: str | None
    identification_count: int
    precision_type: str | None
    named_verse_count: int
    mentioned_at: tuple[str, ...]
    has_reconstruction: bool = False


@dataclass(frozen=True, slots=True)
class TimelineEvent:
    """One dated node on either axis of the History sheet's timeline."""

    id: str
    label: str
    year_label: str
    sort_year: int
    detail: str | None = None


@dataclass(frozen=True, slots=True)
class HistoryPayload:
    """Sheet content for `[History]` -- the dual-axis timeline.

    `passage_title` and `interpretive_claim` travel together or not at all:
    the title is one scholar's division of the text, and Q-015 forbids
    presenting it as settled fact.
    """

    passage_year_label: str
    passage: VerseRange
    biblical_axis: tuple[TimelineEvent, ...]
    world_axis: tuple[TimelineEvent, ...]
    rationale: str
    dating_origin: str
    confidence: float | None = None
    ruler_name: str | None = None
    passage_title: str | None = None
    interpretive_claim: str | None = None
    attributed_to: str | None = None


@dataclass(frozen=True, slots=True)
class RootPayload:
    """Sheet content for `[Root]` -- one original-language word."""

    lemma: str
    language: str
    transliteration: str | None
    strongs_number: str
    gloss: str
    surface: str
    occurrence_count: int
    verse_count: int
    book_count: int
    definition: str | None = None
    morphology: str | None = None


@dataclass(frozen=True, slots=True)
class CrossReferenceTarget:
    """One passage this verse points at."""

    range: VerseRange
    display_reference: str
    votes: int
    text: str | None = None


@dataclass(frozen=True, slots=True)
class CrossRefPayload:
    """Sheet content for `[Cross-Ref]` -- vote-ranked links to scripture."""

    relation: CrossReferenceRelation
    targets: tuple[CrossReferenceTarget, ...]


#: Any of the five sheet payloads.
BadgePayload = RoutePayload | City3dPayload | HistoryPayload | RootPayload | CrossRefPayload
