"""The badge envelope, and the deterministic id every badge is known by.

Purpose
    Everything a badge carries regardless of kind: where it sits, what it
    teases, what it cites, where its content came from, and how valuable it is
    relative to the other badges competing for the same chapter.

Why the id is derived, not stored
    A badge is computed from datasets, not authored, so there is no row to hang
    a surrogate id on. Deriving the id from the badge's own coordinates --
    kind, verse, and the one thing that distinguishes it within that verse --
    makes it stable across calls for free, and makes it parseable, so a sheet
    reopened from a deep link can be rebuilt without a cached list.

    Format: `kind~verse_key~discriminator`. `~` is unreserved in RFC 3986, so
    the whole id is a legal path segment untouched by encoding, and it appears
    in no discriminator we mint (route ids and passage ids use `:` and `-`).

Dependencies
    The badge kind, anchor, payload and provenance modules. Standard library
    otherwise. Rule 5.1.2.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .anchor import BadgeAnchor
from .badge_kind import BadgeKind, parse_badge_kind, priority_of
from .payloads import BadgePayload
from .provenance import Citation, SourceAttribution, all_renderable

_SEPARATOR = "~"
_ID_PARTS = 3


@dataclass(frozen=True, slots=True)
class BadgeId:
    """A badge's identity, in its parsed form."""

    kind: BadgeKind
    verse_key: int
    discriminator: str

    def __str__(self) -> str:
        return f"{self.kind.value}{_SEPARATOR}{self.verse_key}{_SEPARATOR}{self.discriminator}"


def parse_badge_id(value: str) -> BadgeId | None:
    """Parse an id that arrived from a client.

    @param value: The path segment, untrusted.
    @returns The parsed id, or None when it names no M2 kind, carries a
        non-numeric verse key, or has an empty discriminator. Side effects: none.
    """
    parts = value.split(_SEPARATOR, _ID_PARTS - 1)
    if len(parts) != _ID_PARTS:
        return None
    kind = parse_badge_kind(parts[0])
    if kind is None or not parts[2]:
        return None
    if not parts[1].isdigit():
        return None
    return BadgeId(kind=kind, verse_key=int(parts[1]), discriminator=parts[2])


@dataclass(frozen=True, slots=True)
class InlineBadge:
    """One badge, ready to render.

    `rank_score` is how this badge argued for its place in the chapter. It is
    never sent to the client -- it is a selection input, not content -- but it
    lives on the badge so the selection rules in `selection.py` stay pure
    functions over a list rather than needing a parallel structure.
    """

    id: BadgeId
    kind: BadgeKind
    anchor: BadgeAnchor
    teaser: str
    payload: BadgePayload
    sources: tuple[SourceAttribution, ...]
    citations: tuple[Citation, ...] = field(default_factory=tuple)
    rank_score: float = 0.0

    @property
    def is_renderable(self) -> bool:
        """AI-05 in one expression: no provenance, no render.

        A badge must name at least one complete source and carry at least one
        citation chip. Both are checked here, at the last point before
        selection, so no builder can forget and no route can leak one.
        """
        return all_renderable(self.sources) and bool(self.citations)

    @property
    def sort_key(self) -> tuple[int, int, float, int, str]:
        """A total order over badges, with no ties left to chance.

        Verse first, because the reader meets them in reading order; then kind
        priority; then value; then position in the verse; then the id, which is
        unique, so two runs over the same chapter cannot come back in different
        orders.
        """
        return (
            self.anchor.verse_key,
            priority_of(self.kind),
            -self.rank_score,
            self.anchor.start_offset,
            str(self.id),
        )

    @property
    def value_key(self) -> tuple[float, int, int, str]:
        """A total order by value, for deciding what the chapter cap drops."""
        return (
            -self.rank_score,
            priority_of(self.kind),
            self.anchor.verse_key,
            str(self.id),
        )
