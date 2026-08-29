"""Domain-to-wire mapping for the badge endpoints.

Purpose
    Keep `schemas.py` readable as a contract by moving the translation here.
    Nothing in this module decides anything: it renames fields and nothing else,
    so a reviewer checking the API shape reads one file and a reviewer checking
    the mapping reads the other.

Why `rank_score` never appears
    It is a selection input, not content. Publishing it would invite a client
    to re-sort the badges, which is the server re-deciding something it already
    decided and would break the guarantee that two readers on the same chapter
    see the same page.

Dependencies
    The badge application and domain layers, and the wire models beside this
    file.
"""

from __future__ import annotations

from ..application import ChapterBadges
from ..domain import (
    BadgePayload,
    City3dPayload,
    CrossRefPayload,
    HistoryPayload,
    InlineBadge,
    MappedLocation,
    RootPayload,
    RoutePayload,
    SourceAttribution,
    TimelineEvent,
)
from .schemas import (
    AnchorOut,
    BadgeOut,
    ChapterBadgesOut,
    CitationOut,
    City3dPayloadOut,
    CrossReferenceTargetOut,
    CrossRefPayloadOut,
    HistoryPayloadOut,
    MapCameraOut,
    MappedLocationOut,
    PayloadOut,
    RootPayloadOut,
    RoutePayloadOut,
    SourceOut,
    TimelineEventOut,
    VerseRangeOut,
)


def to_source(source: SourceAttribution) -> SourceOut:
    """Map one provenance record to the wire."""
    return SourceOut(
        key=source.key,
        name=source.name,
        license=source.licence,
        attribution=source.attribution,
        share_alike=source.share_alike,
        url=source.url,
        version=source.version,
        retrieved_at=source.retrieved_at,
    )


def to_badge(badge: InlineBadge) -> BadgeOut:
    """Map one badge to the wire. `rank_score` is deliberately not published:
    it is a selection input, not content, and a client sorting by it would be
    re-deciding something the server already decided."""
    return BadgeOut(
        id=str(badge.id),
        kind=badge.kind.value,
        anchor=AnchorOut(
            verse_key=badge.anchor.verse_key,
            text=badge.anchor.text,
            start_offset=badge.anchor.start_offset,
            end_offset=badge.anchor.end_offset,
        ),
        teaser=badge.teaser,
        citations=[
            CitationOut(
                id=citation.id,
                kind=citation.kind,
                label=citation.label,
                osis=citation.osis,
                source_name=citation.source_name,
                url=citation.url,
            )
            for citation in badge.citations
        ],
        sources=[to_source(source) for source in badge.sources],
        payload=to_payload(badge.payload),
    )


def to_chapter_badges(result: ChapterBadges) -> ChapterBadgesOut:
    """Map the chapter use case's result to the wire."""
    return ChapterBadgesOut(
        reference=result.reference,
        translation=result.translation,
        book_number=result.book.book_number,
        chapter=result.chapter,
        badges=[to_badge(badge) for badge in result.badges],
        sources=[to_source(source) for source in result.sources],
    )


def to_payload(payload: BadgePayload) -> PayloadOut:
    """Map a sheet payload to its wire model.

    An exhaustive dispatch, closed with a raise: reaching the end means a sixth
    payload type was added to the union without a case here, which is a
    programming error and must fail loudly (rule 6.1.5).
    """
    mapper = _PAYLOAD_MAPPERS.get(type(payload))
    if mapper is None:
        raise TypeError(f"No wire model for badge payload {type(payload).__name__}.")
    return mapper(payload)


def _location_out(point: MappedLocation) -> MappedLocationOut:
    """One pin, with both of its DECISIONS #10 caveats.

    Written once rather than at each of the two call sites: the caveats were
    added because a pin that omits them reads as certainty, and a second copy
    is how one of them would come to omit them again.
    """
    return MappedLocationOut(
        name=point.name,
        coordinates=point.coordinates,
        role=point.role,
        feature_type=point.feature_type,
        place_id=point.place_id,
        verse_key=point.verse_key,
        shared_name_count=point.shared_name_count,
        candidate_count=point.candidate_count,
    )


def _route_out(payload: RoutePayload) -> RoutePayloadOut:
    return RoutePayloadOut(
        title=payload.title,
        waypoints=[_location_out(point) for point in payload.waypoints],
        camera=MapCameraOut(
            center=payload.camera.center, zoom_level=payload.camera.zoom_level
        ),
        passage=VerseRangeOut(
            start_key=payload.passage.start_key, end_key=payload.passage.end_key
        ),
        scheme=payload.scheme,
    )


def _city_out(payload: City3dPayload) -> City3dPayloadOut:
    return City3dPayloadOut(
        location=_location_out(payload.location),
        modern_name=payload.modern_name,
        identification_count=payload.identification_count,
        precision_type=payload.precision_type,
        named_verse_count=payload.named_verse_count,
        mentioned_at=list(payload.mentioned_at),
        has_reconstruction=payload.has_reconstruction,
    )


def _history_out(payload: HistoryPayload) -> HistoryPayloadOut:
    return HistoryPayloadOut(
        passage_year_label=payload.passage_year_label,
        passage=VerseRangeOut(
            start_key=payload.passage.start_key, end_key=payload.passage.end_key
        ),
        biblical_axis=[_node_out(node) for node in payload.biblical_axis],
        world_axis=[_node_out(node) for node in payload.world_axis],
        rationale=payload.rationale,
        dating_origin=payload.dating_origin,
        confidence=payload.confidence,
        ruler_name=payload.ruler_name,
        passage_title=payload.passage_title,
        interpretive_claim=payload.interpretive_claim,
        attributed_to=payload.attributed_to,
    )


def _node_out(node: TimelineEvent) -> TimelineEventOut:
    """One timeline node, either axis."""
    return TimelineEventOut(
        id=node.id,
        label=node.label,
        year_label=node.year_label,
        sort_year=node.sort_year,
        detail=node.detail,
    )


def _root_out(payload: RootPayload) -> RootPayloadOut:
    return RootPayloadOut(
        lemma=payload.lemma,
        language=payload.language,
        transliteration=payload.transliteration,
        strongs_number=payload.strongs_number,
        gloss=payload.gloss,
        surface=payload.surface,
        occurrence_count=payload.occurrence_count,
        verse_count=payload.verse_count,
        book_count=payload.book_count,
        definition=payload.definition,
        morphology=payload.morphology,
    )


def _cross_ref_out(payload: CrossRefPayload) -> CrossRefPayloadOut:
    return CrossRefPayloadOut(
        relation=payload.relation,
        targets=[
            CrossReferenceTargetOut(
                range=VerseRangeOut(
                    start_key=target.range.start_key, end_key=target.range.end_key
                ),
                display_reference=target.display_reference,
                votes=target.votes,
                text=target.text,
            )
            for target in payload.targets
        ],
    )


_PAYLOAD_MAPPERS = {
    RoutePayload: _route_out,
    City3dPayload: _city_out,
    HistoryPayload: _history_out,
    RootPayload: _root_out,
    CrossRefPayload: _cross_ref_out,
}
