"""How many badges a chapter gets, and which ones. The product judgement.

Purpose
    Every rule in this file exists to stop the feature destroying the thing it
    decorates. The datasets can justify a badge on nearly every verse of Acts
    16 -- 21 place mentions, 40 verses with cross-references, 13 aligned words
    in verse 14 alone. Rendering all of them would turn a page of scripture
    into a page of pills, which fails pillar 1 (a pristine reading canvas)
    while nominally satisfying pillar 2.

The four rules, and why each number is what it is

    1. ONE BADGE PER RUN OF CHARACTERS. Two pills after the same word cannot
       both be "immediately after the word" (`design-language.md` section 5),
       and the annotated word can only be tinted one hue. Overlapping anchors
       collide too, not just identical ones: a pill inside a tinted phrase
       reads as a rendering bug. Ties go to P-04's own listing order, which
       puts the badges anchored to a proper noun ahead of the ones annotating
       the whole verse -- the more specific claim about those characters wins.

    2. AT MOST TWO BADGES PER VERSE. A BSB verse averages about 25 words, which
       is two lines on a phone. One pill is an invitation; two is a choice;
       three is a toolbar sitting in the middle of a sentence. Two is the
       largest number that still leaves the verse readable as prose.

    3. A PER-KIND QUOTA. Without one, cross-references alone would fill every
       chapter, because they are the densest dataset we have (344,799 rows) and
       not because they are the most valuable thing on the page. The quota
       guarantees the reader meets variety: the journey, the sites, the dating,
       the words, the links. Route gets 1 because a chapter has one journey.

    4. TWELVE BADGES PER CHAPTER. Section 5 also specifies a summary list of
       every badge at the foot of the chapter, for the reader who does not tap
       mid-verse. Twelve rows is about a screen and a half; past that the
       summary stops being a summary and becomes a second document. The quotas
       sum to 13, so this cap genuinely bites and drops the least valuable
       badge in the chapter rather than being decorative.

Dependencies
    The badge envelope and kind. Pure functions, no I/O, no clock. Rule 5.1.2.
"""

from __future__ import annotations

from collections import Counter

from .badge import InlineBadge
from .badge_kind import BadgeKind

#: Rule 2. See the module docstring.
MAX_BADGES_PER_VERSE = 2

#: Rule 4. See the module docstring.
MAX_BADGES_PER_CHAPTER = 12

#: Rule 3. Sums to 13, one more than the chapter cap, deliberately.
CHAPTER_QUOTA: dict[BadgeKind, int] = {
    BadgeKind.ROUTE: 1,
    BadgeKind.CITY_3D: 2,
    BadgeKind.HISTORY: 2,
    BadgeKind.ROOT: 4,
    BadgeKind.CROSS_REF: 4,
}


def select_chapter_badges(candidates: list[InlineBadge]) -> list[InlineBadge]:
    """Apply all four rules and return the chapter's badges in reading order.

    @param candidates: Every badge the builders could justify. May be empty.
    @returns The surviving badges, ordered by `InlineBadge.sort_key`, so the
        same chapter returns the same list in the same order every call.
        Side effects: none.
    """
    renderable = [badge for badge in candidates if badge.is_renderable]
    placed = _place_within_verses(renderable)
    quota_kept = _apply_quota(placed)
    capped = _apply_chapter_cap(quota_kept)
    return sorted(capped, key=lambda badge: badge.sort_key)


def _place_within_verses(candidates: list[InlineBadge]) -> list[InlineBadge]:
    """Rules 1 and 2, in one pass over each verse's candidates.

    Candidates are considered in `sort_key` order, which is priority-first
    within a verse, so the badge that should win a collision is simply the one
    seen first.
    """
    taken: dict[int, list[tuple[int, int]]] = {}
    kept: list[InlineBadge] = []
    for badge in sorted(candidates, key=lambda item: item.sort_key):
        spans = taken.setdefault(badge.anchor.verse_key, [])
        if len(spans) >= MAX_BADGES_PER_VERSE:
            continue
        if any(_overlaps(badge.anchor.span, span) for span in spans):
            continue
        spans.append(badge.anchor.span)
        kept.append(badge)
    return kept


def _overlaps(left: tuple[int, int], right: tuple[int, int]) -> bool:
    """True when two half-open character ranges share a character."""
    return left[0] < right[1] and right[0] < left[1]


def _apply_quota(candidates: list[InlineBadge]) -> list[InlineBadge]:
    """Rule 3: keep only each kind's most valuable N."""
    used: Counter[BadgeKind] = Counter()
    kept: list[InlineBadge] = []
    for badge in sorted(candidates, key=lambda item: item.value_key):
        allowed = CHAPTER_QUOTA.get(badge.kind, 0)
        if used[badge.kind] >= allowed:
            continue
        used[badge.kind] += 1
        kept.append(badge)
    return kept


def _apply_chapter_cap(candidates: list[InlineBadge]) -> list[InlineBadge]:
    """Rule 4: the twelve most valuable badges in the chapter."""
    ordered = sorted(candidates, key=lambda item: item.value_key)
    return ordered[:MAX_BADGES_PER_CHAPTER]
