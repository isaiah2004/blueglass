"""Which published spellings of a place a badge is allowed to claim.

Purpose
    `place_names` is a RESOLVER index: it exists so that a name emitted
    anywhere -- by a model, by a search box -- can be turned into a coordinate,
    and for that job a wide net is the right net. "Ammonites" resolving to
    Ammon and "Bethelite" resolving to Bethel are both useful there.

    A badge is the opposite job. It takes a place and puts a word on the page,
    tinted, with a pill beside it asserting that the word names that place.
    Pillar 3 -- "every claim carries a citation, or it is not rendered" --
    makes the wide net a liability: a resolver alias that is not a name of the
    place is a false claim the moment it is rendered. Measured over the 682
    route chapters, 20 spatial badges tinted a people-word or an epithet, 44
    map pins carried the published name of a DIFFERENT place and were plotted
    25-1,423 km from it, and 45 waypoints were labelled with a people or a
    person under the heading "places named in this chapter".

    This module is the gate between the two jobs. `place_names` is untouched --
    the resolver keeps its wide net -- and a badge sees only the rows that are
    names of the place in the reader's own English.

The four gates, each measured against the live gazetteer
    Attestation. OpenBible counts, per place, how many times each spelling is
        used across ten translations. A spelling used for fewer than one
        mention in ten is a stray reading, not a name. Jerusalem publishes
        "Jerusalem" 7,819 times and "Jews" once; Babylon publishes "Babylon"
        2,480 times and "Tyre" once, which is how Ezekiel 26:7 came to pin
        Babylon's coordinate and label it Tyre, 865 km away.
    Another place's name. A spelling that some other gazetteer row publishes as
        its own name cannot label this one. "Galilee" is a weight-2 alias of
        Judea, and Luke 2:4 drew two pins both reading "Galilee" while never
        naming Judea, which the verse spells.
    People-words. An English gentilic ending on a spelling that no place
        publishes as its own name is a people, not a place: Ammonites,
        Chaldeans, Canaanite, Egyptians, Bethelite, Tishbite, Gerasenes. The
        exemption for a published place name is what keeps Lachish, Tarshish,
        Carchemish and Midian -- real names with those endings -- intact.
    Bare generic terms. "Sea" is a published spelling of both Great Sea and
        Salt Sea, and a pin labelled "Sea" names nothing.

    Measured through the shipped pipeline over all 682 derived routes: 4,298
    waypoints on 632 badges, down from 4,399, and none of them now names a
    people, a person, or another place. What survives is what should: the
    remaining labels that differ from the gazetteer's headword are the
    translation's own spellings, which is the point -- "Negev" for Negeb,
    "Euphrates River" for Euphrates, "Field of Blood" for Akeldama.

What is deliberately NOT gated
    The place's own published name. A `primary` row is the gazetteer's answer
    to "what is this place called", and no gate here may overrule it.

Dependencies
    `anchor` only, for `PlaceSpelling` and the folding rule. Pure. Rule 5.1.2.
"""

from __future__ import annotations

from collections.abc import Iterable

from .place_spelling import PlaceSpelling

#: The share of a place's best-attested spelling that a variant must reach.
#:
#: 0.10 is measured, not chosen for roundness. At 0.05 "Esau" (46 uses against
#: Edom's 855) survives as a label for Edom; at 0.10 it does not, and every
#: variant a sheet should print is comfortably above it -- "Kiriath-arba" is
#: 8% of Hebron and is the one true spelling this costs us, against 878 false
#: claims it removes.
MIN_ATTESTATION_SHARE = 0.10

#: English gentilic endings, longest first so the longest one wins.
#:
#: Every one of these was drawn from a spelling the live gazetteer actually
#: publishes: -ite/-ites/-itess (Bethelite, Ammonites, Ammonitess),
#: -ian/-ians (Egyptians), -ean/-eans (Chaldeans), -an/-ans (Samaritan,
#: Assyrians), -ines (Philistines), -ims, -ish, -ene/-enes (Gerasenes).
GENTILIC_SUFFIXES = (
    "itess",
    "enes",
    "ites",
    "ians",
    "eans",
    "ines",
    "ene",
    "ite",
    "ian",
    "ean",
    "ans",
    "ims",
    "ish",
    "an",
)

#: The shortest stem a gentilic ending may be stripped from.
#:
#: Without it "Dan" would read as a gentilic of "D". Three characters is the
#: shortest stem any place name in the loaded gazetteer has.
MIN_GENTILIC_STEM = 3

#: Words that describe a feature rather than name one.
#:
#: Each is published as a spelling of at least one place -- "Sea" for both
#: Great Sea and Salt Sea, "River" for Euphrates -- and a pin labelled with one
#: of them names nothing a reader can check. A place whose own name IS one of
#: these keeps it: the gate applies to variants only.
GENERIC_TERMS = frozenset(
    {
        "sea",
        "river",
        "valley",
        "city",
        "mountain",
        "mount",
        "wilderness",
        "desert",
        "brook",
        "gate",
        "town",
        "land",
        "plain",
        "spring",
        "well",
        "hill",
        "lake",
        "island",
        "field",
        "garden",
        "pool",
        "road",
        "way",
        "tower",
        "stream",
    }
)


def anchorable(spellings: Iterable[PlaceSpelling]) -> tuple[PlaceSpelling, ...]:
    """The spellings a badge may tint in scripture or print on a pin.

    @param spellings: Every `primary` and `translation` row for one place.
    @returns Those that name the place in English, always including its own
        published name. Order is the input's; `name_anchor` ranks them.
        Side effects: none.
    """
    candidates = tuple(spellings)
    best = max((spelling.attestation for spelling in candidates), default=0)
    return tuple(
        spelling
        for spelling in candidates
        if spelling.is_primary or _is_a_name(spelling, best)
    )


def _is_a_name(spelling: PlaceSpelling, best_attestation: int) -> bool:
    """True when a translation's variant is a name of the place it is filed under.

    @param spelling: A `translation` row.
    @param best_attestation: The highest attestation any spelling of this place
        has, which is the denominator the share is measured against.
    @returns Whether all four gates pass. Side effects: none.
    """
    if best_attestation and spelling.attestation < best_attestation * MIN_ATTESTATION_SHARE:
        return False
    if spelling.names_another_place:
        return False
    if spelling.normalised in GENERIC_TERMS:
        return False
    return not names_a_people(spelling.normalised)


def names_a_people(normalised: str) -> bool:
    """True when a folded spelling reads as a people rather than as a place.

    Exported because the same question is worth asking of a name arriving from
    anywhere, and because a rule this consequential should be testable on its
    own rather than only through a badge.

    @param normalised: A folded spelling, from `normalise_name`.
    @returns Whether it carries an English gentilic ending on a long enough
        stem. Side effects: none.
    """
    return any(
        normalised.endswith(suffix) and len(normalised) - len(suffix) >= MIN_GENTILIC_STEM
        for suffix in GENTILIC_SUFFIXES
    )
