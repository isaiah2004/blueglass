"""Wire models for the badge endpoints. The published contract.

Purpose
    Publish an explicit, versionable contract. These models are what FastAPI
    puts in the OpenAPI document, which is what the TypeScript client is
    generated from -- so a field renamed here becomes a compile error in
    `apps/mobile`, not a runtime surprise in front of a reader.

Shape: ONE polymorphic response, not five endpoints
    `payload` is a discriminated union keyed on `kind`, mirroring
    `InlineBadge` in `packages/shared/src/badges.ts`. The reader never wants
    "the Route badges of Acts 16"; they want "the badges of Acts 16", and five
    endpoints would force the client to fan out, merge, and re-apply the
    per-verse cap in code that no server test covers.

AI-05 on the wire
    Every badge carries `sources`, and every source carries `license` and
    `attribution` -- the string the licence obliges us to print. The chapter
    response repeats the union of them at the top level so the attribution
    strip can be drawn without walking every badge.

Dependencies
    Pydantic and the standard library. The domain-to-wire mapping lives beside
    this file in `mappers.py`, so the contract can be read without reading the
    translation of it.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class SourceOut(BaseModel):
    """Provenance for one dataset. AI-05: without this, nothing renders."""

    key: str = Field(description="Stable data_sources key, e.g. openbible_geocoding.")
    name: str
    license: str = Field(description="SPDX-style identifier, e.g. CC-BY-4.0.")
    attribution: str = Field(description="The line the licence obliges us to print.")
    share_alike: bool = Field(description="True when the licence is copyleft.")
    url: str | None = None
    version: str | None = None
    retrieved_at: date | None = None


class CitationOut(BaseModel):
    """One evidence chip beside a claim."""

    id: str
    kind: str
    label: str
    osis: str | None = None
    source_name: str | None = None
    url: str | None = None


class AnchorOut(BaseModel):
    """Where the pill sits: an exact character range in one verse."""

    verse_key: int
    text: str = Field(description="The annotated word, as it appears in the verse.")
    start_offset: int = Field(ge=0, description="0-based, into the verse text.")
    end_offset: int = Field(gt=0, description="One past the last character.")


class VerseRangeOut(BaseModel):
    """A span of verses, both endpoints inclusive."""

    start_key: int
    end_key: int


class MappedLocationOut(BaseModel):
    """A pin. `coordinates` is [longitude, latitude] -- GeoJSON order.

    The last two fields are DECISIONS #10 on the wire: a sheet showing one pin
    for a shared or disputed identification has to say the identification is
    shared. `shared_name_count` is how many different ancient places carry this
    name (nine are called Ramah); `candidate_count` is how many modern dig
    sites are proposed for THIS place (777 of 1,342 have more than one). Both
    are 1 when there is nothing to caveat.
    """

    name: str
    coordinates: tuple[float, float]
    role: str
    feature_type: str
    place_id: str
    verse_key: int
    shared_name_count: int = 1
    candidate_count: int = 1


class MapCameraOut(BaseModel):
    """Where the map opens. Computed from the pins, not sourced."""

    center: tuple[float, float]
    zoom_level: float


class TimelineEventOut(BaseModel):
    """One node on either axis of the History sheet."""

    id: str
    label: str
    year_label: str = Field(description="As the sources express it, e.g. AD 47.")
    sort_year: int = Field(description="Ordering only. Never render this.")
    detail: str | None = None


class CrossReferenceTargetOut(BaseModel):
    """One linked passage, both endpoints preserved."""

    range: VerseRangeOut
    display_reference: str
    votes: int
    text: str | None = None


class RoutePayloadOut(BaseModel):
    """Sheet content for `[Route]`."""

    kind: Literal["route"] = "route"
    title: str
    waypoints: list[MappedLocationOut]
    camera: MapCameraOut
    passage: VerseRangeOut
    scheme: str


class City3dPayloadOut(BaseModel):
    """Sheet content for `[3D City]` -- the site, not a reconstruction.

    `has_reconstruction` is False for every row this milestone ships. No
    openly-licensed 3D reconstruction of a biblical city exists
    (`dataset-validation.md` 4.3); the field is the interface a commissioned
    model drops into later.
    """

    kind: Literal["3d-city"] = "3d-city"
    location: MappedLocationOut
    modern_name: str | None = None
    identification_count: int = Field(description="Candidate modern sites proposed.")
    precision_type: str | None = None
    named_verse_count: int = Field(
        description="Verses of the canon whose text spells this place's name."
    )
    mentioned_at: list[str]
    has_reconstruction: bool


class HistoryPayloadOut(BaseModel):
    """Sheet content for `[History]` -- the dual-axis timeline."""

    kind: Literal["history"] = "history"
    passage_year_label: str
    passage: VerseRangeOut
    biblical_axis: list[TimelineEventOut]
    world_axis: list[TimelineEventOut]
    rationale: str = Field(description="Why this passage carries this date.")
    dating_origin: str = Field(description="sourced, generated, or authored.")
    confidence: float | None = None
    ruler_name: str | None = None
    passage_title: str | None = Field(
        default=None, description="One scholar's heading. Render with attributed_to."
    )
    interpretive_claim: str | None = Field(
        default=None, description='Q-015: e.g. "Murai\'s reading". Never settled fact.'
    )
    attributed_to: str | None = None


class RootPayloadOut(BaseModel):
    """Sheet content for `[Root]` -- one original-language word."""

    kind: Literal["root"] = "root"
    lemma: str
    language: str
    transliteration: str | None = None
    strongs_number: str
    gloss: str
    surface: str = Field(description="The word as this verse's original text spells it.")
    occurrence_count: int
    verse_count: int
    book_count: int
    definition: str | None = None
    morphology: str | None = None


class CrossRefPayloadOut(BaseModel):
    """Sheet content for `[Cross-Ref]`."""

    kind: Literal["cross-ref"] = "cross-ref"
    relation: str
    targets: list[CrossReferenceTargetOut]


#: The sheet payload, discriminated on `kind` -- the same discriminant the
#: TypeScript union in `packages/shared/src/badges.ts` narrows on. Declaring it
#: to Pydantic means the OpenAPI document publishes a real `oneOf` with a
#: discriminator, so the generated client narrows instead of guessing.
PayloadOut = Annotated[
    RoutePayloadOut
    | City3dPayloadOut
    | HistoryPayloadOut
    | RootPayloadOut
    | CrossRefPayloadOut,
    Field(discriminator="kind"),
]


class BadgeOut(BaseModel):
    """One inline badge, ready to render."""

    id: str = Field(description="kind~verse_key~discriminator. Stable across calls.")
    kind: str
    anchor: AnchorOut
    teaser: str = Field(description="One line for the chapter summary list.")
    citations: list[CitationOut]
    sources: list[SourceOut]
    payload: PayloadOut


class ChapterBadgesOut(BaseModel):
    """GET /badges/chapters/{translation}/{book}/{chapter}."""

    reference: str = Field(description="Human reference, e.g. Acts 16.")
    translation: str
    book_number: int
    chapter: int
    badges: list[BadgeOut]
    sources: list[SourceOut] = Field(
        description="Union of every source the badges rest on, for the attribution strip."
    )
