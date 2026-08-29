"""The five badge kinds M2 ships, and the order they win arguments in.

Purpose
    `packages/shared/src/badges/badge-kind.ts` enumerates eleven kinds for the
    whole product. Decision P-04 selects five of them for this milestone, and
    only those five have deterministic data behind them today. This module is
    that subset, plus the total order two colliding badges are resolved by.

Key responsibilities
    - Name the five kinds with the exact wire strings the TypeScript union uses.
      These are the discriminant the client switches on; renaming one is a
      breaking change, not a refactor.
    - Define badge priority, so a collision has one answer and not two.

Dependencies
    Standard library only. This is the innermost module of the badge domain.

Usage
    BadgeKind.ROUTE.value        # "route"
    priority_of(BadgeKind.ROOT)  # 3
"""

from __future__ import annotations

from enum import StrEnum


class BadgeKind(StrEnum):
    """A badge kind shipping in M2.

    Values match `BadgeKind` in `packages/shared/src/badges/badge-kind.ts`
    character for character. A test asserts that, so the two cannot drift.
    """

    ROUTE = "route"
    CITY_3D = "3d-city"
    HISTORY = "history"
    ROOT = "root"
    CROSS_REF = "cross-ref"


#: The five kinds in decision P-04's own listing order.
#:
#: That order is reused as the priority order, which is not a coincidence
#: dressed up as a rule: P-04 lists the spatial badges first because they are
#: the ones anchored to a proper noun the reader can see on the map, and the
#: verse-level badges last because they annotate the whole verse rather than a
#: word. When two badges want the same run of characters, the one making the
#: more specific claim about those characters should win.
M2_BADGE_KINDS: tuple[BadgeKind, ...] = (
    BadgeKind.ROUTE,
    BadgeKind.CITY_3D,
    BadgeKind.HISTORY,
    BadgeKind.ROOT,
    BadgeKind.CROSS_REF,
)

_PRIORITY: dict[BadgeKind, int] = {kind: index for index, kind in enumerate(M2_BADGE_KINDS)}


def priority_of(kind: BadgeKind) -> int:
    """Rank a kind for collision resolution. Lower wins.

    @param kind: Any M2 badge kind.
    @returns Its 0-based position in `M2_BADGE_KINDS`. Total over the enum, so
        there is no failure branch. Side effects: none.
    """
    return _PRIORITY[kind]


def parse_badge_kind(value: str) -> BadgeKind | None:
    """Narrow an untrusted string to a badge kind.

    Badge ids arrive from the client in a URL path, so the kind embedded in one
    is untrusted input and is checked at the boundary (rule 6.5.1).

    @param value: A candidate discriminant.
    @returns The kind, or None when the string names no M2 kind.
        Side effects: none.
    """
    for kind in M2_BADGE_KINDS:
        if kind.value == value:
            return kind
    return None
