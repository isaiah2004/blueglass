"""The History badge: a dated passage, on a dual-axis timeline.

Purpose
    `docs/product/mockups/image5.png` wants two series -- scripture's own events
    on one axis, the world's rulers on the other -- plus a date for the passage
    the reader is standing in. All three are in Postgres, so this builder is
    arithmetic and joins, not judgement.

Granularity: one badge per DATED PASSAGE, not per event
    Acts 16 contains eight dated events. Eight History pills would be eight
    openings onto near-identical timelines, which is noise dressed as depth.
    `passage_dating` is keyed to a pericope, which is the unit a reader
    actually experiences as "a scene", so that is the unit that earns a badge.
    Acts 16 yields two.

Q-015 and Q-016, enforced here
    The passage TITLE is Hajime Murai's division of the text, not a neutral
    fact, so it travels only with its attribution and is dropped when that
    attribution cannot be resolved. The DATE is New Testament only -- the
    schema's CHECK constraints guarantee no Old Testament row can exist, so
    this builder needs no era rule of its own and deliberately has none.

Dependencies
    The badge domain only. Pure. Rule 5.1.2.
"""

from __future__ import annotations

from ..anchor import tail_anchor
from ..badge import BadgeId, InlineBadge
from ..badge_kind import BadgeKind
from ..chapter_data import ChapterBadgeData
from ..payloads import HistoryPayload, TimelineEvent, VerseRange
from ..provenance import source_citation
from ..records import DatedPassageRecord, EventRecord, RulerRecord, VerseText

#: How many years either side of the passage the biblical axis reaches. Wide
#: enough to place the passage inside its journey, narrow enough that the axis
#: is about this passage rather than about the century.
_EVENT_WINDOW_YEARS = 3

#: Nodes per axis. The mockup's timeline is a strip, not a scrollable list.
_MAX_AXIS_NODES = 6

#: The realm the "who was on the throne" line names. Acts is set inside it, and
#: naming a local procurator there would answer a question nobody asked.
_THRONE_REALM = "Roman Empire"

#: A dating is worth showing at all; how much more depends on how much of the
#: passage the source event actually narrates, which is `confidence`.
_HISTORY_FLOOR = 0.40
_HISTORY_RANGE = 0.40


def build_history_badges(data: ChapterBadgeData) -> list[InlineBadge]:
    """One badge per dated passage that overlaps this chapter."""
    built = [_history_badge(data, dated) for dated in data.dated_passages]
    return [badge for badge in built if badge is not None]


def _history_badge(data: ChapterBadgeData, dated: DatedPassageRecord) -> InlineBadge | None:
    """Build one History badge, or None when it cannot be placed or sourced."""
    verse = _first_verse_in_chapter(data, dated)
    if verse is None:
        return None
    anchor = tail_anchor(verse.verse_key, verse.text)
    if anchor is None:
        return None
    claim = dated.claim
    sources = data.sources_for(
        dated.source_key,
        *(ruler.source_key for ruler in data.rulers),
        *(event.source_key for event in data.events),
        claim.source_key if claim is not None else None,
    )
    return InlineBadge(
        id=BadgeId(BadgeKind.HISTORY, anchor.verse_key, dated.passage_id),
        kind=BadgeKind.HISTORY,
        anchor=anchor,
        teaser=_teaser(dated),
        payload=_payload(data, dated),
        sources=sources,
        citations=tuple(
            source_citation(f"history-{index}", "reference-work", source)
            for index, source in enumerate(sources)
        ),
        rank_score=round(_HISTORY_FLOOR + _HISTORY_RANGE * (dated.confidence or 0.0), 4),
    )


def _first_verse_in_chapter(
    data: ChapterBadgeData, dated: DatedPassageRecord
) -> VerseText | None:
    """The earliest verse of the chapter that this passage covers.

    A Murai pericope frequently runs past the chapter end -- Acts 16:11-40 is
    one -- so the badge is placed at the passage's first verse THE READER CAN
    SEE, not at its first verse outright.
    """
    for verse in sorted(data.verses, key=lambda item: item.verse_key):
        if dated.start_key <= verse.verse_key <= dated.end_key:
            return verse
    return None


def _payload(data: ChapterBadgeData, dated: DatedPassageRecord) -> HistoryPayload:
    """Assemble the two axes and the passage's own dating line."""
    claim = dated.claim
    attributed = claim is not None and data.source(claim.source_key) is not None
    return HistoryPayload(
        passage_year_label=dated.year_label,
        passage=VerseRange(dated.start_key, dated.end_key),
        biblical_axis=_biblical_axis(data, dated),
        world_axis=_world_axis(data, dated),
        rationale=dated.rationale,
        dating_origin=dated.origin,
        confidence=dated.confidence,
        ruler_name=_throne_holder(data, dated.year_approx),
        passage_title=dated.title if attributed else None,
        interpretive_claim=claim.claim_label if attributed and claim else None,
        attributed_to=claim.attributed_to if attributed and claim else None,
    )


def _biblical_axis(
    data: ChapterBadgeData, dated: DatedPassageRecord
) -> tuple[TimelineEvent, ...]:
    """Scripture's own events around this passage, in narrative order.

    Chosen NEAREST-FIRST, rendered in narrative order. Picking the first six by
    verse key instead would fill the axis with the earliest events in the
    window -- for Acts 16 that is the first missionary journey, three chapters
    back -- and leave the passage the reader is standing in off its own
    timeline.
    """
    near = [
        event
        for event in data.events
        if abs(event.year_approx - dated.year_approx) <= _EVENT_WINDOW_YEARS
    ]
    nearest = sorted(near, key=lambda item: _closeness(item, dated))
    chosen = nearest[:_MAX_AXIS_NODES]
    ordered = sorted(chosen, key=lambda item: (item.start_key, item.event_id))
    return tuple(_event_node(event) for event in ordered)


def _closeness(event: EventRecord, dated: DatedPassageRecord) -> tuple[int, int, int]:
    """How near an event is to the passage: in years, then in verses."""
    return (
        abs(event.year_approx - dated.year_approx),
        abs(event.start_key - dated.start_key),
        event.event_id,
    )


def _event_node(event: EventRecord) -> TimelineEvent:
    """One biblical-axis node."""
    return TimelineEvent(
        id=f"event-{event.event_id}",
        label=event.title,
        year_label=event.date_label,
        sort_year=event.year_approx,
        detail=event.part_of,
    )


def _world_axis(
    data: ChapterBadgeData, dated: DatedPassageRecord
) -> tuple[TimelineEvent, ...]:
    """Every office open in the passage's year, earliest accession first."""
    holding = [ruler for ruler in data.rulers if ruler.covers(dated.year_approx)]
    ordered = sorted(
        holding, key=lambda item: (item.start_year or -9999, item.realm or "", item.ruler_id)
    )
    return tuple(_ruler_node(ruler) for ruler in ordered[:_MAX_AXIS_NODES])


def _ruler_node(ruler: RulerRecord) -> TimelineEvent:
    """One world-axis node. A missing bound prints as "unrecorded", not a guess."""
    return TimelineEvent(
        id=f"ruler-{ruler.ruler_id}",
        label=_ruler_label(ruler),
        year_label=_reign_label(ruler),
        sort_year=ruler.start_year if ruler.start_year is not None else -9999,
        detail=ruler.realm,
    )


def _ruler_label(ruler: RulerRecord) -> str:
    """The person, their office, and the territory the SOURCE gives it.

    Two rules, both of them about not saying more than is known:

    The realm is appended only when the office label carried one. Wikidata
    records Herod Antipas and Philip as "tetrarch" with no territory, and the
    ingest used to supply "Judaea" -- so 369 badges cited a CC0 source for a
    claim it does not make, about the two men Luke 3:1 lists precisely to
    distinguish them from the ruler of Judaea.

    The title is appended only when the name has not already said it. Wikidata
    knows Philip as "Philip the Tetrarch", so the composed label stuttered:
    "Philip the Tetrarch, Tetrarch of Judaea".
    """
    label = ruler.name if _name_states_the_title(ruler) else f"{ruler.name}, {ruler.title}"
    return label if ruler.realm is None else f"{label} of {ruler.realm}"


def _name_states_the_title(ruler: RulerRecord) -> bool:
    """True when the office is already a word of the person's own name."""
    return ruler.title.casefold() in ruler.name.casefold().split()


def _reign_label(ruler: RulerRecord) -> str:
    """A reign as the sources give it, with unrecorded bounds said out loud."""
    return f"{_year_label(ruler.start_year)} to {_year_label(ruler.end_year)}"


def _year_label(year: int | None) -> str:
    """A signed year as a reader reads it, or "unrecorded".

    A negative year is already the BC year a reference work prints: Wikidata's
    astronomical numbering is converted once, in
    `scripts/wikidata_rulers._parse_xsd_date`, so nothing here has to know that
    `-0003` means 4 BC. Converting a second time would move every band back
    another year.
    """
    if year is None:
        return "unrecorded"
    return f"{-year} BC" if year < 0 else f"AD {year}"


def _throne_holder(data: ChapterBadgeData, year: int) -> str | None:
    """Who held the imperial throne that year, when a source says."""
    for ruler in sorted(data.rulers, key=lambda item: item.ruler_id):
        if ruler.realm == _THRONE_REALM and ruler.covers(year):
            return ruler.name
    return None


def _teaser(dated: DatedPassageRecord) -> str:
    """One line for the chapter summary list."""
    if dated.title and dated.claim is not None:
        return f"{dated.year_label} - {dated.title}"
    return f"{dated.year_label} - the world around this passage"
