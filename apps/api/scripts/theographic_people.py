"""Turn Theographic's People.csv into people, relations and verse mentions.

Purpose
    The Lineage badge needs a genealogy graph: who someone's parents and
    partners are, and every verse that names them. This is the only open
    dataset that publishes parent/child/spouse edges as a graph rather than
    prose (``docs/architecture/dataset-validation.md`` section 3.4 -- STEPBible
    TIPNR disambiguates individuals but does not publish the edges).

Q-007, in one line
    Theographic is CC BY-SA 4.0. Its rows stay in their own tables with their
    own source_id, reachable by ``WHERE share_alike``, and are never blended
    into a record a bundled seed would distribute.

Row selection
    Every row is loaded, ``status`` and all. 2,783 of the 3,069 rows are
    ``wip`` rather than ``publish`` -- Theographic's own marker that a
    person's prose is unfinished -- but ``LineagePerson`` only needs an id, a
    name and an optional epithet (``packages/shared/badges/literary-badge.
    types.ts``), and every field that type needs is complete even on a
    ``wip`` row: name, gender, verses, and (where Theographic recorded them)
    parent and partner ids. Filtering to ``publish`` would drop entire branches
    of the New Testament genealogies (1 Chr 1-9 style lists feed Luke 3 and
    Matthew 1) for want of a paragraph the badge does not render. The
    ``dataset_status`` column keeps the distinction visible for whatever reads
    the table next, rather than deciding silently on its behalf.

Traps
    - The header carries a UTF-8 BOM, so the file must be read as
      ``utf-8-sig``, exactly as ``theographic_events.py`` does.
    - ``verses`` is comma-separated OSIS ids, e.g. ``Ruth.4.17,Ruth.4.22``,
      parsed with the same ``osis_refs.parse_osis_verse`` every other loader
      uses, so book-name tolerance cannot drift between loaders.
    - ``father``, ``mother``, ``partners`` and ``children`` all hold OTHER
      rows' ``personLookup`` values. ``children`` is redundant with the
      inverse of ``father``/``mother`` and is not read, to avoid double-
      writing the same edge from both ends and having them disagree if the
      two ever do (measured: they do not, on the acquired file, but the
      parser should not depend on that staying true).
    - ``partners`` is read as an unordered pair: ``(a, b)`` and ``(b, a)``
      would otherwise both appear if both rows list each other, which
      Theographic's data does for every couple measured.

Dependencies
    Standard library, ``osis_refs`` for the OSIS parse, ``raw_datasets`` for
    the acquired file.

Usage
    dataset = read_people()
"""

from __future__ import annotations

import csv

from scripts.osis_refs import OsisReferenceError, parse_osis_verse
from scripts.person_rows import (
    PARENT_OF,
    SPOUSE_OF,
    PersonDataError,
    PersonMentionRow,
    PersonRelationRow,
    PersonRow,
    PersonDataset,
)
from scripts.raw_datasets import THEOGRAPHIC_PEOPLE, verify_digest

PEOPLE_FILE = "People.csv"

#: Theographic's two genders. A third value would mean the upstream schema
#: changed, and the loader should fail rather than write an unchecked string
#: into a column a UI branches on.
_KNOWN_GENDERS = frozenset({"Male", "Female"})


def _clean(value: str) -> str | None:
    """An optional cell: blank becomes ``None``, everything else is trimmed."""
    trimmed = value.strip()
    return trimmed or None


def _mentions_for(person_id: str, verses: str) -> list[PersonMentionRow]:
    """One row per verse this person is named in."""
    rows: list[PersonMentionRow] = []
    for token in verses.split(","):
        osis = token.strip()
        if not osis:
            continue
        try:
            key = parse_osis_verse(osis)
        except OsisReferenceError as error:
            raise PersonDataError(f"{person_id}: unreadable verse {osis!r}: {error}") from error
        rows.append(PersonMentionRow(person_id, key, osis))
    return rows


def _parent_edges(person_id: str, record: dict[str, str]) -> list[PersonRelationRow]:
    """``father``/``mother`` become ``parent-of`` edges, parent to child."""
    edges: list[PersonRelationRow] = []
    for column in ("father", "mother"):
        parent_id = _clean(record[column])
        if parent_id is not None:
            edges.append(PersonRelationRow(parent_id, person_id, PARENT_OF))
    return edges


def _spouse_edges(
    person_id: str, record: dict[str, str], seen: set[tuple[str, str]]
) -> list[PersonRelationRow]:
    """``partners`` becomes a ``spouse-of`` edge, written once per pair."""
    edges: list[PersonRelationRow] = []
    partners = record["partners"].strip()
    if not partners:
        return edges
    for partner_id in (p.strip() for p in partners.split(",")):
        if not partner_id:
            continue
        pair = tuple(sorted((person_id, partner_id)))
        if pair in seen:
            continue
        seen.add(pair)
        edges.append(PersonRelationRow(pair[0], pair[1], SPOUSE_OF))
    return edges


def _person_row(record: dict[str, str]) -> PersonRow:
    """One CSV record into one ``people`` row."""
    person_id = record["personLookup"].strip()
    if not person_id:
        raise PersonDataError("a row has no personLookup id.")
    gender = record["gender"].strip()
    if gender not in _KNOWN_GENDERS:
        raise PersonDataError(f"{person_id}: unknown gender {gender!r}.")
    name = record["name"].strip()
    if not name:
        raise PersonDataError(f"{person_id}: no name.")
    try:
        verse_count = int(record["verseCount"] or 0)
    except ValueError as error:
        raise PersonDataError(f"{person_id}: unreadable verseCount.") from error
    return PersonRow(
        person_id=person_id,
        name=name,
        display_title=_clean(record["displayTitle"]) or name,
        gender=gender,
        occupations=_clean(record["occupations"]),
        member_of=_clean(record["memberOf"]),
        dataset_status=record["status"].strip(),
        verse_count=verse_count,
    )


def read_people() -> PersonDataset:
    """Every person, relation and mention in the acquired file."""
    path = verify_digest(THEOGRAPHIC_PEOPLE, PEOPLE_FILE)
    people: list[PersonRow] = []
    relations: list[PersonRelationRow] = []
    mentions: list[PersonMentionRow] = []
    seen_pairs: set[tuple[str, str]] = set()
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for record in csv.DictReader(handle):
            row = _person_row(record)
            people.append(row)
            relations.extend(_parent_edges(row.person_id, record))
            relations.extend(_spouse_edges(row.person_id, record, seen_pairs))
            mentions.extend(_mentions_for(row.person_id, record["verses"]))
    return PersonDataset(
        people=tuple(people), relations=tuple(relations), mentions=tuple(mentions)
    )
