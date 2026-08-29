"""The row shapes Theographic's People.csv becomes, and nothing else.

Purpose
    Types only, mirroring ``place_rows.py``'s split from its parser so the
    loader, the assertions and any future domain builder can all name a row
    without importing the CSV reader.

Key responsibilities
    Define one dataclass per destination table: ``people``,
    ``person_relations``, ``person_mentions``.

Dependencies
    Standard library only.

Usage
    from scripts.person_rows import PersonRow, PersonRelationRow, PersonMentionRow
"""

from __future__ import annotations

from dataclasses import dataclass

#: The two edge kinds this loader derives. Theographic also publishes
#: siblings and half-siblings, but ``LineageRelationKind`` in
#: ``packages/shared`` has no sibling edge yet -- extending that union is a
#: product decision (a sibling edge changes what the graph badge draws), not
#: something this loader should decide by adding rows nothing consumes.
PARENT_OF = "parent-of"
SPOUSE_OF = "spouse-of"


class PersonDataError(RuntimeError):
    """A People.csv row could not be interpreted."""


@dataclass(frozen=True, slots=True)
class PersonRow:
    """One row destined for the ``people`` table.

    ``person_id`` is Theographic's own ``personLookup`` (e.g. ``david_994``),
    not a surrogate -- the same reasoning as ``places.place_id`` in
    ``place_rows.py``: a natural key is what makes a re-ingest idempotent
    without renumbering every relation row.
    """

    person_id: str
    name: str
    display_title: str
    gender: str
    occupations: str | None
    member_of: str | None
    dataset_status: str
    verse_count: int


@dataclass(frozen=True, slots=True)
class PersonRelationRow:
    """One edge of the genealogy graph."""

    from_person_id: str
    to_person_id: str
    kind: str


@dataclass(frozen=True, slots=True)
class PersonMentionRow:
    """One person named in one verse."""

    person_id: str
    verse_key: int
    osis_id: str


@dataclass(frozen=True, slots=True)
class PersonDataset:
    """Everything one parse of People.csv produced."""

    people: tuple[PersonRow, ...]
    relations: tuple[PersonRelationRow, ...]
    mentions: tuple[PersonMentionRow, ...]
