"""The 3D City badge: one biblical settlement, as a site rather than a scene.

Purpose
    The chapter names a city; this puts the reader on it. It shares the
    gazetteer rules in `place_support` with the Route badge in `route.py` --
    both have to answer "where in this verse is that place named, and where on
    the earth is it?" -- but the claim is different: Route is about every place
    a passage names, 3D City is about one of them.

The honesty note
    `dataset-validation.md` 4.3 is a confirmed negative: no openly-licensed 3D
    reconstruction of any biblical city exists, and the nearest candidate is
    CC BY-NC-ND, which fails twice over. So this badge ships the SITE, not a
    reconstruction -- the pin, the modern identification, how many
    identifications scholarship actually offers, and where the chapter names
    it. Every one of those is a column of `places` carrying OpenBible's licence.
    Nothing is invented, and `has_reconstruction` is False, which is the truth.

Dependencies
    The badge domain only. Pure. Rule 5.1.2.
"""

from __future__ import annotations

import math

from ..badge import BadgeId, InlineBadge
from ..badge_kind import BadgeKind
from ..chapter_data import ChapterBadgeData
from ..payloads import City3dPayload
from ..provenance import source_citation
from ..records import PlaceRecord
from .place_support import (
    ANCHORABLE_MENTION,
    CITY_FEATURE,
    anchor_on_first_named,
    mapped_location,
    named_mentions_of,
)

#: Scales `named_verse_count` into the 3D City score. 200 verses is roughly
#: Jerusalem's order of magnitude; the log stops a five-verse town scoring
#: forty times below a capital when it is not forty times less interesting.
#: It is scaled from the SAME number the teaser prints, so the badge a chapter
#: shows and the sentence under it cannot be ranked by different evidence.
_CITY_SCALE = math.log10(201.0)
_CITY_FLOOR = 0.35
_CITY_RANGE = 0.45


def build_city_badges(data: ChapterBadgeData) -> list[InlineBadge]:
    """One badge per located settlement the chapter names by name."""
    built = [_city_badge(data, place_id) for place_id in _named_settlements(data)]
    return [badge for badge in built if badge is not None]


def _named_settlements(data: ChapterBadgeData) -> list[str]:
    """Distinct settlement ids, in order of first mention in the chapter."""
    ordered: list[str] = []
    for mention in sorted(data.mentions, key=lambda item: (item.verse_key, item.place_id)):
        place = data.places.get(mention.place_id)
        if place is None or place.place_id in ordered:
            continue
        if mention.mention_kind != ANCHORABLE_MENTION:
            continue
        if place.feature_type != CITY_FEATURE or not place.is_located:
            continue
        ordered.append(place.place_id)
    return ordered


def _city_badge(data: ChapterBadgeData, place_id: str) -> InlineBadge | None:
    """Build one 3D City badge, anchored on its first spelling in the chapter."""
    place = data.places[place_id]
    anchored = anchor_on_first_named(data, named_mentions_of(data, place_id))
    if anchored is None:
        return None
    anchor = anchored[0]
    sources = data.sources_for(place.source_key)
    return InlineBadge(
        id=BadgeId(BadgeKind.CITY_3D, anchor.verse_key, place.place_id),
        kind=BadgeKind.CITY_3D,
        anchor=anchor,
        teaser=_city_teaser(place),
        payload=City3dPayload(
            location=mapped_location(place, place.name, anchor.verse_key, "waypoint"),
            modern_name=place.modern_name,
            identification_count=place.candidate_count,
            precision_type=place.precision_type,
            named_verse_count=place.named_verse_count,
            mentioned_at=_mention_osis(data, place_id),
        ),
        sources=sources,
        citations=tuple(
            source_citation(f"city-{index}", "gazetteer", source)
            for index, source in enumerate(sources)
        ),
        rank_score=_city_score(place),
    )


def _mention_osis(data: ChapterBadgeData, place_id: str) -> tuple[str, ...]:
    """OSIS ids of this chapter's mentions, for the sheet's "named here" list."""
    verses = [data.verse_text(key) for key, _ in named_mentions_of(data, place_id)]
    return tuple(verse.osis_id for verse in verses if verse is not None)


def _renames_the_place(place: PlaceRecord) -> bool:
    """True when the modern name actually tells the reader something new.

    "Jerusalem - today Jerusalem" is a sentence that says nothing, and it was
    shown both inline in the chapter summary and as the sheet's headline claim.
    The gazetteer stores the modern identification for every located place,
    including the many whose name never changed, so the teaser has to ask
    whether the identification is news before it prints it as news.

    Compared case-folded and stripped, because the difference between
    "Jerusalem" and "jerusalem " is a data-entry artefact and not a rename.
    """
    modern = (place.modern_name or "").strip()
    return bool(modern) and modern.casefold() != place.name.strip().casefold()


def _city_teaser(place: PlaceRecord) -> str:
    """One line for the chapter summary list.

    Scholarly disagreement leads when it exists, and there are two kinds of it.
    A shared NAME comes first, because it is the one a reader cannot even
    suspect: nine places are called Ramah, and "Ramah - named in 39 verses"
    reads as a fact about one town. Rival SITES for a single place come next --
    777 of 1,342 ancient places have more than one candidate. DECISIONS #10
    forbids collapsing either to a single confident pin. A real rename follows,
    because "today Tel Lystra" is the fact a reader cannot supply themselves.
    Where the name never changed there is no such fact, so the teaser falls
    back to how much of the canon names the place -- which is the other thing
    the gazetteer knows and the one that separates Jerusalem from Derbe.

    "NAMED in N verses" is a claim about the words on the page, so N counts
    only mentions of kind `name`. `place_mentions` also records people_group,
    common_noun, no_translation, helper and partial rows, and counting those
    told 280 badges' worth of readers that Jerusalem is named in 955 verses
    when 766 spell it -- 2 Samuel 11:22 among the other 189, which names no
    place at all. See `scripts/place_parser.count_named`.
    """
    if place.homonym_count > 1:
        return f"{place.name} - one of {place.homonym_count} places of that name"
    if place.candidate_count > 1:
        return f"{place.name} - {place.candidate_count} proposed sites for this city"
    if _renames_the_place(place):
        return f"{place.name} - today {place.modern_name}"
    verses = "verse" if place.named_verse_count == 1 else "verses"
    return f"{place.name} - named in {place.named_verse_count} {verses} of scripture"


def _city_score(place: PlaceRecord) -> float:
    """How much a reader gains from this site, by how often scripture names it."""
    weight = min(1.0, math.log10(1.0 + place.named_verse_count) / _CITY_SCALE)
    return round(_CITY_FLOOR + _CITY_RANGE * weight, 4)
