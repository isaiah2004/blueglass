"""The selection rules: the four caps, and AI-05's refusal to render.

These are the product judgements the whole feature rests on, so they are tested
as pure functions rather than only through HTTP.
"""

from __future__ import annotations

from app.modules.badges.domain import (
    CHAPTER_QUOTA,
    MAX_BADGES_PER_CHAPTER,
    MAX_BADGES_PER_VERSE,
    BadgeAnchor,
    BadgeId,
    BadgeKind,
    Citation,
    CrossRefPayload,
    InlineBadge,
    SourceAttribution,
    select_chapter_badges,
)

VERSE = 44016014

GOOD_SOURCE = SourceAttribution(
    key="openbible_xref",
    name="OpenBible.info Cross References",
    licence="CC-BY-4.0",
    attribution="Cross-references © OpenBible.info, CC BY 4.0",
    share_alike=False,
)

CITATION = Citation(id="c0", kind="reference-work", label="OpenBible.info")

EMPTY_PAYLOAD = CrossRefPayload(relation="parallel", targets=())


def badge(
    kind: BadgeKind,
    *,
    verse: int = VERSE,
    start: int = 0,
    end: int = 5,
    score: float = 0.5,
    discriminator: str = "x",
    sources: tuple[SourceAttribution, ...] = (GOOD_SOURCE,),
    citations: tuple[Citation, ...] = (CITATION,),
) -> InlineBadge:
    """A badge with just enough of everything to be selectable."""
    return InlineBadge(
        id=BadgeId(kind, verse, discriminator),
        kind=kind,
        anchor=BadgeAnchor(verse, "word", start, end),
        teaser="teaser",
        payload=EMPTY_PAYLOAD,
        sources=sources,
        citations=citations,
        rank_score=score,
    )


def test_empty_input_gives_empty_output() -> None:
    """A chapter with no badge data is not an error condition."""
    assert select_chapter_badges([]) == []


def test_a_badge_without_provenance_is_never_returned() -> None:
    """AI-05: no source anchor, no render. Not a warning -- a drop."""
    unsourced = badge(BadgeKind.ROOT, sources=(), discriminator="unsourced")
    uncited = badge(BadgeKind.ROOT, citations=(), discriminator="uncited", start=10, end=15)
    blank_licence = badge(
        BadgeKind.ROOT,
        sources=(SourceAttribution("k", "Name", "", "Attribution", False),),
        discriminator="blank",
        start=20,
        end=25,
    )
    blank_attribution = badge(
        BadgeKind.ROOT,
        sources=(SourceAttribution("k", "Name", "CC-BY-4.0", "   ", False),),
        discriminator="unattributed",
        start=30,
        end=35,
    )

    kept = select_chapter_badges([unsourced, uncited, blank_licence, blank_attribution])

    assert kept == []


def test_one_bad_source_among_good_ones_still_drops_the_badge() -> None:
    """Partial provenance is not partial credit."""
    mixed = badge(
        BadgeKind.ROOT,
        sources=(GOOD_SOURCE, SourceAttribution("k", "Name", "CC-BY-4.0", "", False)),
    )

    assert select_chapter_badges([mixed]) == []


def test_per_verse_cap_holds() -> None:
    """Three non-overlapping badges in one verse; only two survive."""
    candidates = [
        badge(BadgeKind.ROUTE, start=0, end=5, discriminator="a"),
        badge(BadgeKind.CITY_3D, start=6, end=11, discriminator="b"),
        badge(BadgeKind.ROOT, start=12, end=17, discriminator="c"),
    ]

    kept = select_chapter_badges(candidates)

    assert len(kept) == MAX_BADGES_PER_VERSE
    assert [item.kind for item in kept] == [BadgeKind.ROUTE, BadgeKind.CITY_3D]


def test_overlapping_anchors_collide_and_priority_decides() -> None:
    """Two pills cannot both sit immediately after the same word."""
    candidates = [
        badge(BadgeKind.ROOT, start=10, end=20, score=0.9, discriminator="root"),
        badge(BadgeKind.CITY_3D, start=15, end=25, score=0.1, discriminator="city"),
    ]

    kept = select_chapter_badges(candidates)

    assert [item.kind for item in kept] == [BadgeKind.CITY_3D]


def test_adjacent_anchors_do_not_collide() -> None:
    """Half-open ranges that merely touch are two different words."""
    candidates = [
        badge(BadgeKind.ROOT, start=10, end=20, discriminator="root"),
        badge(BadgeKind.CITY_3D, start=20, end=25, discriminator="city"),
    ]

    assert len(select_chapter_badges(candidates)) == MAX_BADGES_PER_VERSE


def test_per_kind_quota_holds() -> None:
    """Cross-references are the densest dataset and must not fill a chapter."""
    candidates = [
        badge(
            BadgeKind.CROSS_REF,
            verse=44016000 + index,
            score=0.9 - index / 100,
            discriminator=f"x{index}",
        )
        for index in range(1, 20)
    ]

    kept = select_chapter_badges(candidates)

    assert len(kept) == CHAPTER_QUOTA[BadgeKind.CROSS_REF]
    #: Quota keeps the most valuable, so the first verses win here.
    assert [item.anchor.verse_key for item in kept] == [44016001, 44016002, 44016003, 44016004]


def test_chapter_cap_holds_and_drops_the_least_valuable() -> None:
    """The quotas sum to thirteen; a chapter returns at most twelve."""
    candidates: list[InlineBadge] = []
    for kind, quota in CHAPTER_QUOTA.items():
        for index in range(quota):
            candidates.append(
                badge(
                    kind,
                    verse=44016000 + len(candidates) + 1,
                    score=0.9 if kind is not BadgeKind.HISTORY else 0.1,
                    discriminator=f"{kind.value}-{index}",
                )
            )

    kept = select_chapter_badges(candidates)

    assert len(candidates) == MAX_BADGES_PER_CHAPTER + 1
    assert len(kept) == MAX_BADGES_PER_CHAPTER
    assert sum(1 for item in kept if item.kind is BadgeKind.HISTORY) == 1


def test_selection_is_deterministic_whatever_the_input_order() -> None:
    """Row order out of a database must not change what the reader sees."""
    candidates = [
        badge(BadgeKind.ROOT, verse=44016000 + index, discriminator=f"r{index}", score=0.5)
        for index in range(1, 6)
    ]

    forwards = select_chapter_badges(list(candidates))
    backwards = select_chapter_badges(list(reversed(candidates)))

    assert [str(item.id) for item in forwards] == [str(item.id) for item in backwards]


def test_results_come_back_in_reading_order() -> None:
    """A reader meets badges verse by verse, not by rank."""
    candidates = [
        badge(BadgeKind.ROOT, verse=44016009, discriminator="late", score=0.2),
        badge(BadgeKind.ROOT, verse=44016002, discriminator="early", score=0.9),
    ]

    kept = select_chapter_badges(candidates)

    assert [item.anchor.verse_key for item in kept] == [44016002, 44016009]
