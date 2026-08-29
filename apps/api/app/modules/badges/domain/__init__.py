"""Public API of the badge domain. Zero infrastructure imports, by rule 5.1.2."""

from .anchor import BadgeAnchor, name_anchor, span_anchor, tail_anchor
from .badge import BadgeId, InlineBadge, parse_badge_id
from .badge_kind import M2_BADGE_KINDS, BadgeKind, parse_badge_kind, priority_of
from .builders import (
    build_city_badges,
    build_cross_ref_badges,
    build_history_badges,
    build_root_badges,
    build_route_badges,
)
from .camera import frame
from .chapter_data import ChapterBadgeData
from .payloads import (
    BadgePayload,
    City3dPayload,
    CrossReferenceTarget,
    CrossRefPayload,
    GeoCoordinates,
    HistoryPayload,
    LocationRole,
    MapCamera,
    MappedLocation,
    RootPayload,
    RoutePayload,
    TimelineEvent,
    VerseRange,
)
from .place_spelling import PlaceSpelling, normalise_name
from .provenance import Citation, SourceAttribution, all_renderable, source_citation
from .records import (
    AlignedWordRecord,
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
    VerseText,
)
from .selection import (
    CHAPTER_QUOTA,
    MAX_BADGES_PER_CHAPTER,
    MAX_BADGES_PER_VERSE,
    select_chapter_badges,
)
from .spellings import anchorable, names_a_people
from .surface import bare_surface

__all__ = [
    "CHAPTER_QUOTA",
    "M2_BADGE_KINDS",
    "MAX_BADGES_PER_CHAPTER",
    "MAX_BADGES_PER_VERSE",
    "AlignedWordRecord",
    "BadgeAnchor",
    "BadgeId",
    "BadgeKind",
    "BadgePayload",
    "ChapterBadgeData",
    "Citation",
    "City3dPayload",
    "CrossRefPayload",
    "CrossRefRecord",
    "CrossReferenceTarget",
    "DatedPassageRecord",
    "EventRecord",
    "GeoCoordinates",
    "HistoryPayload",
    "InlineBadge",
    "InterpretiveClaim",
    "LexemeRecord",
    "LocationRole",
    "MapCamera",
    "MappedLocation",
    "PlaceMentionRecord",
    "PlaceRecord",
    "PlaceSpelling",
    "RootPayload",
    "RoutePayload",
    "RouteRecord",
    "RouteStopRecord",
    "RulerRecord",
    "SourceAttribution",
    "TimelineEvent",
    "VerseRange",
    "VerseText",
    "all_renderable",
    "anchorable",
    "bare_surface",
    "build_city_badges",
    "build_cross_ref_badges",
    "build_history_badges",
    "build_root_badges",
    "build_route_badges",
    "frame",
    "name_anchor",
    "names_a_people",
    "normalise_name",
    "parse_badge_id",
    "parse_badge_kind",
    "priority_of",
    "select_chapter_badges",
    "source_citation",
    "span_anchor",
    "tail_anchor",
]
