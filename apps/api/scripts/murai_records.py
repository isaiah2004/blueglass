"""The row shapes the Murai ingest produces, and the passage id scheme.

Purpose
    ``Q-009`` stores passages as well as verses, and Murai's pericope list is
    the open dataset that supplies the boundaries. Putting the row types and
    the id scheme here means the pericope loader and the structure loader mint
    exactly the same ``passage_id`` for the same verse range -- if they drifted,
    every structure would attach to nothing.

Key responsibilities
    - Name the four workbooks.
    - Mint a deterministic, collision-free ``passage_id``.
    - Hold the parsed pericope, unit and node shapes.

Dependencies
    ``murai_spans`` only. No I/O, no database.

Usage
    passage_id_for(44_001_001, 44_001_011)   # 'murai:44001001-44001011'
"""

from __future__ import annotations

from dataclasses import dataclass

from scripts.murai_spans import Span

#: ``passages.scheme`` for everything this ingest writes. The column exists so
#: a second pericope tradition can coexist without a migration, and Murai is
#: emphatically one tradition among several.
SCHEME = "murai"

PERICOPE_LIST_FILES = (
    "LiteraryStructureoftheBible_PericopeList_OT.xlsx",
    "LiteraryStructureoftheBible_PericopeList_NT.xlsx",
)

STRUCTURE_FILES = (
    "LiteraryStructureoftheBible_PericopeStructure_OT.xlsx",
    "LiteraryStructureoftheBible_PericopeStructure_NT.xlsx",
)


def passage_id_for(start_key: int, end_key: int) -> str:
    """The id for one passage, derived only from the verses it covers.

    Derived rather than sequential on purpose: the structure workbook writes
    the same range in a different notation from the pericope list
    (``Act3:1-4:4`` against ``3:1-26 4:1-4``), so the only reliable join
    between the two files is the range itself.
    """
    return f"{SCHEME}:{start_key:09d}-{end_key:09d}"


@dataclass(frozen=True, slots=True)
class Pericope:
    """One row of the pericope list -- a passage boundary with a title."""

    passage_id: str
    book_number: int
    chapter: int
    start_key: int
    end_key: int
    title: str
    ordinal: int


@dataclass(frozen=True, slots=True)
class StructureNode:
    """One labelled limb of a literary structure."""

    node_index: int
    label: str
    pair_label: str
    is_centre: bool
    start_key: int
    end_key: int
    summary: str | None
    catchword: str | None


@dataclass(frozen=True, slots=True)
class StructureUnit:
    """One pericope's structure: an ordered set of nodes plus its legend."""

    passage_id: str
    book_number: int
    span: Span
    pattern: str
    centre_label: str | None
    legend: str | None
    nodes: tuple[StructureNode, ...]


@dataclass(slots=True)
class ParseTally:
    """What the parser did, so the loader can report measurements not hopes.

    Mutable and accumulated as the sheets are read. Every field is printed by
    the loader and several are asserted, so a change in the upstream workbooks
    surfaces as a failed load rather than as quietly missing badges.
    """

    units: int = 0
    #: Headers Murai wrote with a one-line description and no chiastic limbs.
    unstructured_units: int = 0
    nodes: int = 0
    repaired_labels: int = 0
    orphan_nodes: int = 0
    skipped_rows: int = 0
    glosses_kept: int = 0
    glosses_dropped: int = 0
