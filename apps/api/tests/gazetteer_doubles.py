"""Gazetteer spellings, as a test double rather than as three private copies.

Purpose
    A `PlaceRecord` now carries `place_names` ROWS -- kind, attestation, and
    whether another place publishes the same string -- because the badge domain
    has to weigh them (`domain/spellings.py`). Three test modules were each
    building that by hand, and a fourth would have made four subtly different
    ideas of what a well-formed spelling set looks like.

Fidelity
    These are shaped like the rows the loader writes. `published` is a place's
    own name plus the translation variants that are genuinely attested for it;
    `alias` builds the two kinds of junk the live gazetteer really contains --
    a people-word ("Bethelite" for Bethel) and another place's name ("Tyre" for
    Babylon) -- so a regression test can assert on the thing that shipped.
"""

from __future__ import annotations

from app.modules.badges.domain import PlaceSpelling, normalise_name

#: What a well-attested variant looks like beside its primary. Any value clears
#: `MIN_ATTESTATION_SHARE` against `PRIMARY_ATTESTATION`.
VARIANT_ATTESTATION = 40

#: A primary name's raw translation count, as OpenBible publishes it.
PRIMARY_ATTESTATION = 100


def primary(name: str) -> PlaceSpelling:
    """The place's own published name."""
    return PlaceSpelling(
        normalised=normalise_name(name),
        name=name,
        kind="primary",
        attestation=PRIMARY_ATTESTATION,
    )


def variant(name: str, attestation: int = VARIANT_ATTESTATION) -> PlaceSpelling:
    """A translation's spelling of the same place, well enough attested to show."""
    return PlaceSpelling(
        normalised=normalise_name(name),
        name=name,
        kind="translation",
        attestation=attestation,
    )


def alias(
    name: str, *, names_another_place: bool = False, attestation: int = 1
) -> PlaceSpelling:
    """A resolver alias that is NOT a name of the place in English.

    @param name: The alias, e.g. "Bethelite" or "Tyre".
    @param names_another_place: True when some other gazetteer row publishes
        this exact string as its own name.
    @param attestation: How many translation uses OpenBible counted. The default
        is the real figure for the aliases that shipped a false claim: one.
    """
    return PlaceSpelling(
        normalised=normalise_name(name),
        name=name,
        kind="translation",
        attestation=attestation,
        names_another_place=names_another_place,
    )


def published(name: str, *variants: str) -> tuple[PlaceSpelling, ...]:
    """A place's own name plus every attested variant of it."""
    return (primary(name), *(variant(form) for form in variants))
