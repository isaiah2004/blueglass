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

The anchorable-SPELLING rule
    A mention kind is a claim about the whole mention, not about which word
    carries it, and it is unanimous far less often than it looks: OpenBible
    records 1 Kings 16:34 as `name: 5, people_group: 5` for Bethel, the
    dominant kind wins, and the English on the reader's screen spells only
    "the Bethelite". So the kind gate is necessary and nowhere near
    sufficient. `spellings.anchorable` is the second gate, and it is the one
    that decides which WORD may be tinted: see that module for the four rules
    and what each of them measured.

The named-in-this-text rule
    A mention kind is also the gazetteer's claim about the gazetteer's own
    text, not about the translation on the reader's screen, and the two
    disagree: BSB renders Acts 27:2 as "an Adramyttian ship" and Acts 27:6 as
    "an Alexandrian ship" -- the same construction, naming no place -- where
    OpenBible's kinds are `name` and `people_group` respectively. Left to the
    kind alone, the chapter listed the first and not the second.
    `spelling_in_verse` therefore asks the verse itself and returns the words
    the verse uses, which is the only string a sheet headed "places named in
    this chapter" is entitled to print; the spelling gates then refuse both
    adjectives, so the two sentences are finally treated alike.

Why there is one anchor function and not two halves
    There used to be two. `spelling_in_verse` stripped a leading article from
    the pin LABEL and `anchor_on_first_named` did not, so 63 spatial badges
    tinted "the Jordan" while the pin beside them read "Jordan". Both now go
    through `name_anchor`, which measures a spelling's length with the article
    already removed, so the span and the label are the same characters by
    construction rather than by two rules agreeing.

Dependencies
    The badge domain only. Pure. Rule 5.1.2.
"""

from __future__ import annotations

from ..anchor import BadgeAnchor, name_anchor
from ..chapter_data import ChapterBadgeData
from ..payloads import GeoCoordinates, LocationRole, MappedLocation
from ..records import PlaceRecord
from ..spellings import anchorable

#: The one mention kind whose place name appears verbatim in the English text.
ANCHORABLE_MENTION = "name"

#: A 3D City badge is about a settlement. Regions and islands are route
#: waypoints, not sites with a street plan.
CITY_FEATURE = "settlement"


def name_anchor_in_verse(
    data: ChapterBadgeData, verse_key: int, place: PlaceRecord
) -> BadgeAnchor | None:
    """Where this verse names this place, or None when it does not.

    The single seam every spatial claim passes through: the mention kind has
    already said the gazetteer thinks the place is named here, and this asks
    the rendered translation whether a word on the page actually spells it.

    @param data: The chapter, for verse text.
    @param verse_key: The verse the mention is recorded against.
    @param place: The place to look for.
    @returns The anchor over the words the verse uses, or None. Side effects: none.
    """
    verse = data.verse_text(verse_key)
    if verse is None:
        return None
    return name_anchor(verse_key, verse.text, anchorable(place.spellings))


def spelling_in_verse(
    data: ChapterBadgeData, verse_key: int, place: PlaceRecord
) -> str | None:
    """The words this verse uses for the place, or None when it names none.

    The gazetteer publishes several spellings per place and its own headword is
    not always one the reader will see: `places.name` prefers its own
    transliteration to the translation's ("Negeb" where BSB prints "Negev").
    That string occurs in no chapter, so it may not be listed as a name a
    chapter uses. What the verse spells is returned instead -- but only when
    the verse spells a name of THIS place, which is what stopped 44 waypoints
    carrying another place's name.

    @param data: The chapter, for verse text.
    @param verse_key: The verse the mention is recorded against.
    @param place: The place to look for.
    @returns The substring of the verse, longest attested name first ("Oak of
        Moreh" over "Moreh") and without a leading article, or None.
        Side effects: none.
    """
    anchor = name_anchor_in_verse(data, verse_key, place)
    return None if anchor is None else anchor.text


def coordinates_of(place: PlaceRecord) -> GeoCoordinates:
    """`[longitude, latitude]`, GeoJSON order.

    @param place: A place the caller has already checked with `is_located`.
    @returns Its pin. Side effects: none.
    """
    return (float(place.lng or 0.0), float(place.lat or 0.0))


def mapped_location(
    place: PlaceRecord, spelling: str, verse_key: int, role: LocationRole
) -> MappedLocation:
    """One pin, carrying every caveat the gazetteer attaches to it.

    `shared_name_count` travels with the pin because the sheet cannot ask for
    it later: 1,153 of the route waypoints canon-wide carry a name that 2 to 9
    different places share, and DECISIONS #10 forbids presenting one of them as
    the settled identification. `candidate_count` is the same rule one level
    down -- rival dig sites for a single place rather than rival places for a
    single name -- and both have to reach the reader or neither means anything.

    @param place: The gazetteer row.
    @param spelling: The words the verse used, which is what the pin is labelled.
    @param verse_key: The verse that named it.
    @param role: The part it plays, where the scheme can establish one.
    @returns The pin. Side effects: none.
    """
    return MappedLocation(
        name=spelling,
        coordinates=coordinates_of(place),
        role=role,
        feature_type=place.feature_type,
        place_id=place.place_id,
        verse_key=verse_key,
        shared_name_count=place.homonym_count,
        candidate_count=place.candidate_count,
    )


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
        anchor = name_anchor_in_verse(data, verse_key, place)
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
