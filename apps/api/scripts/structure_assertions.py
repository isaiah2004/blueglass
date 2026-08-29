"""What must be true after the literary-structure ingest, checked in Postgres.

Purpose
    The prototype's ``load_more_translations.py`` asserted nothing, and nobody
    could tell whether it had worked. These checks run inside the loading
    transaction, so a failure rolls the load back instead of publishing it.

Two kinds of check live here, and both matter
    - COUNTS. Every number below was measured from the acquired workbooks on
      2026-08-29. A different number means the upstream files changed, and that
      should stop a load rather than silently move a badge's coverage.
    - LICENCE. Murai's spreadsheets quote the NAB, NRSV and NJB, which are not
      his to license. ``murai_copyright`` drops those cells; this module proves
      in SQL that none survived, because a filter nobody verifies is a hope.

Dependencies
    asyncpg and the parsed records. No application code.

Usage
    await assert_structure_is_sound(connection, source_id, pericopes, units, tally)
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from scripts.murai_records import SCHEME, ParseTally, Pericope, StructureUnit

#: Measured from the 2022-02-24 workbooks on 2026-08-29. Not copied from the
#: author's site, and not rounded: these are parse results.
EXPECTED_PERICOPES = 1_959
EXPECTED_UNIT_HEADERS = 1_933
EXPECTED_UNSTRUCTURED_UNITS = 103
EXPECTED_STRUCTURES = 1_830
EXPECTED_NODES = 10_085
EXPECTED_ORPHAN_NODES = 228
EXPECTED_REPAIRED_LABELS = 2
EXPECTED_PASSAGES = 2_005

#: Fifteen node spans in the Old Testament sheets reach outside the unit header
#: that owns them -- Exodus 18's header reads 18:7-27 while its first limb
#: starts at 18:1. These are upstream inconsistencies, not parse errors: they
#: are pinned rather than repaired, because inventing a boundary Murai did not
#: write would be worse than recording that his two cells disagree. NONE of
#: them is in the New Testament.
EXPECTED_NODES_OUTSIDE_THEIR_PASSAGE = 15

#: Acts is the MVP scope, so it gets its own spot check.
ACTS_BOOK = 44

#: Matthew. Nothing above this line may be wrong, because it is what the MVP
#: reads; below it, one scholar's Old Testament sheets carry known oddities.
FIRST_NT_BOOK = 40
EXPECTED_ACTS_STRUCTURES = 49
EXPECTED_ACTS_NODES = 344

#: Any cell containing a verse reference or a quotation mark is a quotation of
#: somebody's translation. Nothing Murai wrote himself contains either.
_QUOTATION_PATTERN = r"[0-9]+[[:space:]]*:[[:space:]]*[0-9]+|[\"“”]"


class StructureIntegrityFailure(RuntimeError):
    """The literary-structure ingest failed one or more post-load checks."""


@dataclass(frozen=True, slots=True)
class Check:
    """One assertion: a label a human reads when it fails, and its SQL.

    ``params`` exists so that not one character of SQL in this file is built by
    string formatting. Every value a query needs -- the scheme, the book
    number, the quotation pattern -- crosses as a bound parameter.
    """

    label: str
    sql: str
    expected: int
    params: tuple[object, ...] = ()


def _parse_failures(
    pericopes: list[Pericope], units: list[StructureUnit], tally: ParseTally
) -> list[str]:
    """Compare what the parser produced against what was measured at acquisition."""
    measured: tuple[tuple[str, int, int], ...] = (
        ("pericopes parsed", len(pericopes), EXPECTED_PERICOPES),
        ("unit headers seen", tally.units, EXPECTED_UNIT_HEADERS),
        ("units with no structure", tally.unstructured_units, EXPECTED_UNSTRUCTURED_UNITS),
        ("structures parsed", len(units), EXPECTED_STRUCTURES),
        ("nodes parsed", tally.nodes, EXPECTED_NODES),
        ("orphan nodes skipped", tally.orphan_nodes, EXPECTED_ORPHAN_NODES),
        ("repaired node labels", tally.repaired_labels, EXPECTED_REPAIRED_LABELS),
    )
    return [
        f"{label}: expected {expected}, got {actual}"
        for label, actual, expected in measured
        if actual != expected
    ]


def _count_checks(passage_count: int, node_count: int) -> tuple[Check, ...]:
    """Did every row the parser produced actually land?"""
    return (
        # The EXISTS clause is not decoration: it proves the provenance row the
        # rest of the checks hang off actually landed.
        Check(
            "murai passages stored",
            """
            SELECT count(*) FROM passages
            WHERE scheme = $2
              AND EXISTS (SELECT 1 FROM data_sources WHERE id = $1)
            """,
            passage_count,
            (SCHEME,),
        ),
        Check(
            "structures stored",
            "SELECT count(*) FROM literary_structures WHERE source_id = $1",
            EXPECTED_STRUCTURES,
        ),
        Check(
            "nodes stored",
            """
            SELECT count(*) FROM structure_nodes n
            JOIN literary_structures s ON s.id = n.structure_id
            WHERE s.source_id = $1
            """,
            node_count,
        ),
    )


def _licence_checks() -> tuple[Check, ...]:
    """Q-015 and AI-05, proven in SQL rather than trusted to a UI."""
    return (
        Check(
            "structures presented as settled fact (must be none)",
            """
            SELECT count(*) FROM literary_structures
            WHERE source_id = $1 AND claim_type <> 'interpretive'
            """,
            0,
        ),
        Check(
            "structures with no attribution (must be none)",
            """
            SELECT count(*) FROM literary_structures
            WHERE source_id = $1
              AND (btrim(attributed_to) = '' OR btrim(claim_label) = '')
            """,
            0,
        ),
        Check(
            "node summaries quoting a copyrighted translation (must be none)",
            """
            SELECT count(*) FROM structure_nodes n
            JOIN literary_structures s ON s.id = n.structure_id
            WHERE s.source_id = $1 AND n.summary ~ $2
            """,
            0,
            (_QUOTATION_PATTERN,),
        ),
        Check(
            "legends quoting a copyrighted translation (must be none)",
            """
            SELECT count(*) FROM literary_structures
            WHERE source_id = $1 AND legend ~ $2
            """,
            0,
            (_QUOTATION_PATTERN,),
        ),
        Check(
            "structures whose source has no displayable attribution (must be none)",
            """
            SELECT count(*) FROM literary_structures s
            JOIN data_sources d ON d.id = s.source_id
            WHERE s.source_id = $1 AND btrim(d.attribution) = ''
            """,
            0,
        ),
    )


def _coverage_checks() -> tuple[Check, ...]:
    """Acts is the MVP scope, so its coverage is asserted, not assumed."""
    return (
        Check(
            "Acts structures",
            """
            SELECT count(*) FROM literary_structures s
            JOIN passages p ON p.passage_id = s.passage_id
            WHERE s.source_id = $1 AND p.book_number = $2
            """,
            EXPECTED_ACTS_STRUCTURES,
            (ACTS_BOOK,),
        ),
        Check(
            "Acts nodes",
            """
            SELECT count(*) FROM structure_nodes n
            JOIN literary_structures s ON s.id = n.structure_id
            JOIN passages p ON p.passage_id = s.passage_id
            WHERE s.source_id = $1 AND p.book_number = $2
            """,
            EXPECTED_ACTS_NODES,
            (ACTS_BOOK,),
        ),
    )


def _shape_checks() -> tuple[Check, ...]:
    """Invariants a mis-resolved book or a mis-read label would break."""
    return (
        Check(
            "nodes reaching outside their own passage",
            """
            SELECT count(*) FROM structure_nodes n
            JOIN literary_structures s ON s.id = n.structure_id
            JOIN passages p ON p.passage_id = s.passage_id
            WHERE s.source_id = $1
              AND (n.start_key < p.start_key OR n.end_key > p.end_key)
            """,
            EXPECTED_NODES_OUTSIDE_THEIR_PASSAGE,
        ),
        Check(
            "New Testament nodes reaching outside their passage (must be none)",
            """
            SELECT count(*) FROM structure_nodes n
            JOIN literary_structures s ON s.id = n.structure_id
            JOIN passages p ON p.passage_id = s.passage_id
            WHERE s.source_id = $1 AND p.book_number >= $2
              AND (n.start_key < p.start_key OR n.end_key > p.end_key)
            """,
            0,
            (FIRST_NT_BOOK,),
        ),
        Check(
            "chiasms with more than one centre (must be none)",
            """
            SELECT count(*) FROM (
                SELECT n.structure_id FROM structure_nodes n
                JOIN literary_structures s ON s.id = n.structure_id
                WHERE s.source_id = $1 AND n.is_centre
                GROUP BY n.structure_id HAVING count(*) > 1
            ) AS multiple
            """,
            0,
        ),
    )


def _checks(passage_count: int, node_count: int) -> tuple[Check, ...]:
    """Every check that runs against the committed rows.

    The source id is bound by the runner rather than passed here: every query
    below takes it as ``$1``, so there is exactly one place it can be wrong.
    """
    return (
        *_count_checks(passage_count, node_count),
        *_licence_checks(),
        *_coverage_checks(),
        *_shape_checks(),
    )


async def assert_structure_is_sound(
    connection: asyncpg.Connection,
    source_id: int,
    pericopes: list[Pericope],
    units: list[StructureUnit],
    tally: ParseTally,
) -> None:
    """Raise listing everything wrong, or return silently."""
    problems = _parse_failures(pericopes, units, tally)
    passage_count = len(
        {item.passage_id for item in pericopes} | {unit.passage_id for unit in units}
    )
    if passage_count != EXPECTED_PASSAGES:
        problems.append(
            f"distinct passages: expected {EXPECTED_PASSAGES}, got {passage_count}"
        )
    node_count = sum(len(unit.nodes) for unit in units)
    for check in _checks(passage_count, node_count):
        actual = await connection.fetchval(check.sql, source_id, *check.params)
        if actual != check.expected:
            problems.append(f"{check.label}: expected {check.expected}, got {actual}")
    if problems:
        joined = "\n  - ".join(problems)
        raise StructureIntegrityFailure(
            f"Murai literary structure failed post-load checks:\n  - {joined}"
        )
