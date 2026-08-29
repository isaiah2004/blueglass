"""The Cross-Ref badge: where else scripture says this.

Purpose
    OpenBible publishes 344,799 community-voted links. Turning them into badges
    is entirely a filtering problem: almost every verse in the canon has one,
    so the question is never "does this verse have cross-references" but "does
    this verse have a link strong enough to interrupt reading for".

The vote threshold, and why it is high
    Acts 16 has cross-references on 40 of its 40 verses. At votes > 0 the badge
    would appear on every single one. The vote distribution across the chapter
    runs from 3 to 43, and only nine verses reach ten. Ten is therefore the bar:
    it is where a link stops being "someone once thought so" and becomes a
    consensus a reader benefits from being shown. The number lives here as a
    named constant so it can be tuned against the corpus rather than guessed at
    again.

The relation is always `parallel`
    `CrossReferenceRelation` allows quotation, allusion, fulfilment and
    parallel. OpenBible publishes a vote count and nothing else -- it does not
    say WHY two verses are linked. Labelling an unlabelled link "fulfilment"
    would be the badge inventing a claim, so every M2 cross-reference is the
    neutral `parallel` until a source that distinguishes them is acquired.

Dependencies
    The badge domain only. Pure. Rule 5.1.2.
"""

from __future__ import annotations

from collections import defaultdict

from ..anchor import tail_anchor
from ..badge import BadgeId, InlineBadge
from ..badge_kind import BadgeKind
from ..chapter_data import ChapterBadgeData
from ..payloads import CrossReferenceTarget, CrossRefPayload, VerseRange
from ..provenance import Citation, SourceAttribution, source_citation
from ..records import CrossRefRecord

#: A verse earns a badge only when its strongest link reaches this many votes.
MIN_VOTES = 10

#: Links shown on the sheet. Enough to be a study aid, few enough to be a list.
MAX_TARGETS = 6

#: Votes at which a link is treated as maximally strong for ranking. The
#: strongest link in Acts 16 has 43; beyond about 40 the difference stops
#: telling a reader anything new.
_VOTE_CEILING = 40.0

_XREF_FLOOR = 0.30
_XREF_RANGE = 0.60


def build_cross_ref_badges(data: ChapterBadgeData) -> list[InlineBadge]:
    """One badge per verse whose strongest cross-reference clears the bar."""
    built = [
        _cross_ref_badge(data, verse_key, refs)
        for verse_key, refs in sorted(_by_verse(data).items())
    ]
    return [badge for badge in built if badge is not None]


def _by_verse(data: ChapterBadgeData) -> dict[int, list[CrossRefRecord]]:
    """Group the chapter's references by citing verse, strongest first.

    Links below the threshold are dropped here, not merely ignored when
    choosing whether to badge: a 3-vote link listed beside a 43-vote one on the
    same sheet reads as though the two carry equal weight.
    """
    grouped: dict[int, list[CrossRefRecord]] = defaultdict(list)
    for reference in data.cross_refs:
        if reference.votes < MIN_VOTES:
            continue
        grouped[reference.from_key].append(reference)
    for references in grouped.values():
        references.sort(key=_strength_key)
    return dict(grouped)


def _strength_key(reference: CrossRefRecord) -> tuple[int, int, int]:
    """Most-voted first, then canonical order. Total, so ordering is stable."""
    return (-reference.votes, reference.to_start_key, reference.to_end_key)


def _cross_ref_badge(
    data: ChapterBadgeData, verse_key: int, references: list[CrossRefRecord]
) -> InlineBadge | None:
    """Build one Cross-Ref badge, or None when the verse does not qualify."""
    if not references or references[0].votes < MIN_VOTES:
        return None
    verse = data.verse_text(verse_key)
    if verse is None:
        return None
    anchor = tail_anchor(verse_key, verse.text)
    if anchor is None:
        return None
    shown = references[:MAX_TARGETS]
    sources = data.sources_for(*(reference.source_key for reference in shown))
    return InlineBadge(
        id=BadgeId(BadgeKind.CROSS_REF, verse_key, "openbible"),
        kind=BadgeKind.CROSS_REF,
        anchor=anchor,
        teaser=_teaser(shown),
        payload=CrossRefPayload(
            relation="parallel",
            targets=tuple(_target(reference) for reference in shown),
        ),
        sources=sources,
        citations=_citations(shown, sources),
        rank_score=_xref_score(references[0].votes),
    )


def _target(reference: CrossRefRecord) -> CrossReferenceTarget:
    """One linked passage, both endpoints preserved.

    88,150 published rows name a RANGE, 637 of them crossing a chapter. Keeping
    both endpoints is what lets the sheet render "Rom 8:1-4" as one chip rather
    than as four verses or, as the Flutter prototype did, as its first verse.
    """
    return CrossReferenceTarget(
        range=VerseRange(reference.to_start_key, reference.to_end_key),
        display_reference=reference.display_reference,
        votes=reference.votes,
        text=reference.text,
    )


def _citations(
    references: list[CrossRefRecord], sources: tuple[SourceAttribution, ...]
) -> tuple[Citation, ...]:
    """The dataset chip, plus a scripture chip per linked passage.

    Cross-Ref is the one badge whose evidence is itself scripture, so the sheet
    can cite the verses directly rather than only the dataset that collected
    them.
    """
    dataset = tuple(
        source_citation(f"xref-source-{index}", "reference-work", source)
        for index, source in enumerate(sources)
    )
    passages = tuple(
        Citation(
            id=f"xref-{index}",
            kind="scripture",
            label=reference.display_reference,
        )
        for index, reference in enumerate(references)
    )
    return dataset + passages


def _teaser(references: list[CrossRefRecord]) -> str:
    """One line for the chapter summary list."""
    top = references[0]
    if len(references) == 1:
        return f"Linked to {top.display_reference}"
    return f"{len(references)} linked passages, strongest {top.display_reference}"


def _xref_score(votes: int) -> float:
    """Consensus strength, flattened above the ceiling."""
    weight = min(1.0, votes / _VOTE_CEILING)
    return round(_XREF_FLOOR + _XREF_RANGE * weight, 4)
