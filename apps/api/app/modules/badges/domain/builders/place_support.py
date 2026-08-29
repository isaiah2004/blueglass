"""Gazetteer rules the two spatial badges share.

Purpose
    Route and 3D City both have to answer "where in this verse is that place
    named, and where on the earth is it?". Answering it once, here, is what
    stops the two badges disagreeing about which word to tint.

The anchorable-mention rule
    OpenBible classifies every place mention. Only `name` means the English
    text actually spells the place; `no_translation`, `people_group`,
    `common_noun`, `helper` and `partial` all mean the verse refers to the
    place some other way. Anchoring on those would tint a word that is not the
    place name -- Acts 16:9 mentions Greece with kind `no_translation`, and a
    pill on "Macedonia" claiming to be Greece is exactly the class of quiet
    wrongness AI-05 exists to prevent.

Dependencies
    The badge domain only. Pure. Rule 5.1.2.
"""

from __future__ import annotations

from ..anchor import BadgeAnchor, name_anchor
from ..chapter_data import ChapterBadgeData
from ..payloads import GeoCoordinates
from ..records import PlaceRecord

#: The one mention kind whose place name appears verbatim in the English text.
ANCHORABLE_MENTION = "name"

#: A 3D City badge is about a settlement. Regions and islands are route
#: waypoints, not sites with a street plan.
CITY_FEATURE = "settlement"


def coordinates_of(place: PlaceRecord) -> GeoCoordinates:
    """`[longitude, latitude]`, GeoJSON order.

    @param place: A place the caller has already checked with `is_located`.
    @returns Its pin. Side effects: none.
    """
    return (float(place.lng or 0.0), float(place.lat or 0.0))


def anchor_on_first_named(
    data: ChapterBadgeData, stops: list[tuple[int, PlaceRecord]]
) -> tuple[BadgeAnchor, PlaceRecord] | None:
    """Anchor on the earliest candidate whose name the verse actually spells.

    @param data: The chapter, for verse text.
    @param stops: (verse_key, place) pairs, already in the order to try.
    @returns The anchor and the place it landed on, or None when no candidate's
        name occurs in its verse -- in which case there is nothing honest to
        tint and the badge is not built. Side effects: none.
    """
    for verse_key, place in stops:
        verse = data.verse_text(verse_key)
        if verse is None:
            continue
        anchor = name_anchor(verse_key, verse.text, place.spellings)
        if anchor is not None:
            return (anchor, place)
    return None


def named_mentions_of(data: ChapterBadgeData, place_id: str) -> list[tuple[int, PlaceRecord]]:
    """Every verse in the chapter that names this place, in verse order."""
    place = data.places.get(place_id)
    if place is None:
        return []
    return [
        (mention.verse_key, place)
        for mention in sorted(data.mentions, key=lambda item: item.verse_key)
        if mention.place_id == place_id and mention.mention_kind == ANCHORABLE_MENTION
    ]
