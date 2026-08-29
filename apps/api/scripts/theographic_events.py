"""Turn Theographic's event table into dated, verse-keyed rows.

Purpose
    The History badge's inner axis is "what happened here, and when". This is
    the only open dataset that dates biblical events against explicit verse
    references, and decision Q-016 governs how much of it may be used.

Q-016, in one paragraph
    Theographic's dating descends from Ussher's *Annals of the World* -- its
    first row places creation at 4004 BC. For New Testament passages that
    chronology is broadly uncontroversial and is what any study Bible prints.
    For the Old Testament it encodes a biblical-literalist position mainstream
    scholarship rejects, and presenting it as neutral fact would be a
    credibility problem. So this parser reads NEW TESTAMENT EVENTS ONLY, and
    the schema refuses anything else besides.

Q-007, in one line
    Theographic is CC BY-SA 4.0. Its rows stay in their own table with their
    own source_id, never blended into a record that mixes licences.

Traps
    - The header's first column carries a UTF-8 BOM, so the file must be read
      as ``utf-8-sig`` or the title column is called ``\\ufefftitle``.
    - ``startDate`` appears as ``0030``, ``0030-05-01`` and ``-4003``; only the
      leading signed integer is reliable.
    - One event routinely spans several books (the harmonised gospels), so a
      single start/end key pair would claim verses it never touches. One row
      per event per book instead.

Dependencies
    Standard library, the scripture domain's book lookup, ``raw_datasets``.

Usage
    events = read_new_testament_events()
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass

from app.modules.scripture.domain.book_lookup import book_number_from_any
from scripts.raw_datasets import THEOGRAPHIC_EVENTS, verify_digest

EVENTS_FILE = "Events.csv"

#: Matthew through Revelation. The Q-016 boundary, in book numbers.
FIRST_NT_BOOK = 40
LAST_NT_BOOK = 66

#: The band the schema also enforces. Nothing New Testament falls outside it.
EARLIEST_YEAR = -120
LATEST_YEAR = 180

_LEADING_YEAR = re.compile(r"^(-?\d+)")
_CHAPTER_FACTOR = 1_000
_BOOK_FACTOR = 1_000_000


class EventDataError(ValueError):
    """An event row could not be interpreted."""


@dataclass(frozen=True, slots=True)
class EventRow:
    """One dated event, restricted to the verses it occupies in one book."""

    external_id: str
    title: str
    year_approx: int
    date_label: str
    book_number: int
    start_key: int
    end_key: int
    part_of: str | None


def year_label_for(year: int) -> str:
    """Render a year the way a reader expects: 'AD 33', '4 BC'.

    Year zero does not exist in the historical calendar, so a source that
    writes ``0`` is describing 1 BC. Both of this milestone's sources document
    negatives as BC, and no New Testament row is affected either way.
    """
    if year > 0:
        return f"AD {year}"
    return f"{abs(year) or 1} BC"


def _parse_year(value: str) -> int:
    """The leading signed integer of a Theographic ``startDate``."""
    match = _LEADING_YEAR.match(value.strip())
    if match is None:
        raise EventDataError(f"unreadable startDate: {value!r}")
    return int(match.group(1))


def _verse_key_of(reference: str) -> tuple[int, int] | None:
    """An OSIS reference into (book_number, verse_key), or None if unresolvable."""
    parts = reference.strip().split(".")
    if len(parts) != 3:
        return None
    book = book_number_from_any(parts[0])
    if book is None:
        return None
    try:
        chapter, verse = int(parts[1]), int(parts[2])
    except ValueError:
        return None
    return book, book * _BOOK_FACTOR + chapter * _CHAPTER_FACTOR + verse


def _keys_by_book(references: str) -> dict[int, list[int]]:
    """Group one event's verse references by the book they sit in."""
    grouped: dict[int, list[int]] = {}
    for reference in references.split(","):
        resolved = _verse_key_of(reference)
        if resolved is None:
            continue
        book, key = resolved
        grouped.setdefault(book, []).append(key)
    return grouped


def _is_new_testament(grouped: dict[int, list[int]]) -> bool:
    """True only when EVERY book this event touches is in the New Testament.

    Deliberately all-or-nothing. An event whose verse list reaches back into
    the Old Testament is being dated on the Ussher chronology Q-016 excludes,
    even if some of its references are in a gospel.
    """
    return bool(grouped) and all(FIRST_NT_BOOK <= book <= LAST_NT_BOOK for book in grouped)


def _rows_from(record: dict[str, str]) -> list[EventRow]:
    """One CSV record into one row per book it narrates, or nothing."""
    grouped = _keys_by_book(record.get("verses", ""))
    if not _is_new_testament(grouped):
        return []
    year = _parse_year(record["startDate"])
    if not EARLIEST_YEAR <= year <= LATEST_YEAR:
        return []
    title = record["title"].strip()
    if not title:
        raise EventDataError(f"event {record.get('eventID')!r} has no title")
    return [
        EventRow(
            external_id=record["eventID"].strip(),
            title=title,
            year_approx=year,
            date_label=year_label_for(year),
            book_number=book,
            start_key=min(keys),
            end_key=max(keys),
            part_of=(record.get("partOf") or "").strip() or None,
        )
        for book, keys in sorted(grouped.items())
    ]


def read_new_testament_events() -> list[EventRow]:
    """Every New Testament era event, one row per event per book."""
    path = verify_digest(THEOGRAPHIC_EVENTS, EVENTS_FILE)
    rows: list[EventRow] = []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for record in csv.DictReader(handle):
            rows.extend(_rows_from(record))
    return rows
