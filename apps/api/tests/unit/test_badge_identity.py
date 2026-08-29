"""Badge ids: derived, stable, parseable, and closed to untrusted input.

An id is the reader's handle on a sheet. If it were not stable a deep link
would rot; if it were not strictly parsed, a crafted path segment would reach
the builders.
"""

from __future__ import annotations

import pytest

from app.modules.badges.domain import (
    M2_BADGE_KINDS,
    BadgeId,
    BadgeKind,
    parse_badge_id,
    parse_badge_kind,
    priority_of,
)

#: The wire strings the TypeScript union in packages/shared uses. Restated
#: here so a rename on either side fails a test rather than a client.
TYPESCRIPT_KINDS = ("route", "3d-city", "history", "root", "cross-ref")


def test_kind_values_match_the_typescript_union() -> None:
    assert tuple(kind.value for kind in M2_BADGE_KINDS) == TYPESCRIPT_KINDS


def test_priority_follows_p04_listing_order() -> None:
    ordered = sorted(M2_BADGE_KINDS, key=priority_of)

    assert tuple(kind.value for kind in ordered) == TYPESCRIPT_KINDS


@pytest.mark.parametrize(
    "discriminator",
    ["chapter:Acts.16", "murai:044016006-044016010", "a91c509", "11", "openbible"],
)
def test_ids_round_trip_through_every_discriminator_we_mint(discriminator: str) -> None:
    """Route ids carry colons and passage ids carry hyphens; both must survive."""
    original = BadgeId(BadgeKind.ROUTE, 44016001, discriminator)

    assert parse_badge_id(str(original)) == original


def test_id_is_stable_for_the_same_coordinates() -> None:
    assert str(BadgeId(BadgeKind.ROOT, 44016014, "11")) == "root~44016014~11"


@pytest.mark.parametrize(
    "value",
    [
        "",
        "route",
        "route~44016001",
        "route~44016001~",
        "route~notanumber~x",
        "lineage~44016001~x",
        "~44016001~x",
        "ROUTE~44016001~x",
    ],
)
def test_malformed_ids_are_refused(value: str) -> None:
    assert parse_badge_id(value) is None


def test_unknown_kind_is_refused() -> None:
    """Only the five M2 kinds parse, even though eleven exist in the product."""
    assert parse_badge_kind("manuscript") is None
    assert parse_badge_kind("route") is BadgeKind.ROUTE
