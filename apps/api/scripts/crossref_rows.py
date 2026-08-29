"""The cross-reference row shape, and how the published TSV becomes one.

Purpose
    OpenBible.info publishes 344,799 community-voted cross-references as a
    three-column TSV inside a zip. This module turns those bytes into rows and
    nothing else: no database, no side effects, so every parsing rule is unit
    testable without Postgres.

Key responsibilities
    - Assert the licence that travels in the file's own header row.
    - Resolve both endpoints of every reference to integer verse keys.
    - Preserve the vote count unchanged, including the 3,506 rows at or below
      zero, so ranking and filtering stay a read-time decision.

Dependencies
    ``osis_refs`` and the standard library. No I/O.

Usage
    rows = parse_cross_references(archive_text(payload))
"""

from __future__ import annotations

import io
import zipfile
from collections.abc import Iterator
from dataclasses import dataclass

from scripts.osis_refs import parse_osis_range, parse_osis_verse

#: The only member of the published archive.
ARCHIVE_MEMBER = "cross_references.txt"

#: The header row asserts the licence inside the data. If this marker ever
#: stops appearing, the file is not the file we verified and must not load --
#: AI-05 forbids rendering a badge whose provenance we cannot state.
LICENCE_MARKER = "CC-BY"

_EXPECTED_COLUMNS = 3


class CrossReferenceFormatError(RuntimeError):
    """The cross-reference file is not shaped the way the loader requires."""


@dataclass(frozen=True, slots=True)
class CrossReferenceRow:
    """One row destined for the cross_references table."""

    from_key: int
    to_start_key: int
    to_end_key: int
    votes: int


def archive_text(payload: bytes) -> str:
    """Extract the single TSV member from the published zip."""
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        names = archive.namelist()
        if names != [ARCHIVE_MEMBER]:
            raise CrossReferenceFormatError(
                f"Expected exactly [{ARCHIVE_MEMBER!r}] in the archive, got {names!r}."
            )
        return archive.read(ARCHIVE_MEMBER).decode("utf-8")


def assert_licence_header(header: str) -> None:
    """Refuse a file whose header no longer carries the CC-BY assertion."""
    if LICENCE_MARKER not in header:
        raise CrossReferenceFormatError(
            f"The header row no longer asserts {LICENCE_MARKER}: {header!r}. "
            "Refusing to load data whose licence cannot be read from the bytes."
        )


def _parse_row(line: str, line_number: int) -> CrossReferenceRow:
    """Turn one TSV line into a row, naming the line if it cannot be."""
    columns = line.split("\t")
    if len(columns) != _EXPECTED_COLUMNS:
        raise CrossReferenceFormatError(
            f"Line {line_number} has {len(columns)} columns, expected "
            f"{_EXPECTED_COLUMNS}: {line!r}"
        )
    source, target, votes = columns
    try:
        parsed_votes = int(votes)
    except ValueError:
        raise CrossReferenceFormatError(
            f"Line {line_number} has a non-numeric vote count: {votes!r}"
        ) from None
    start, end = parse_osis_range(target)
    return CrossReferenceRow(
        from_key=parse_osis_verse(source),
        to_start_key=start,
        to_end_key=end,
        votes=parsed_votes,
    )


def iter_cross_references(text: str) -> Iterator[CrossReferenceRow]:
    """Yield one row per data line, after checking the licence header."""
    lines = text.split("\n")
    if not lines:
        raise CrossReferenceFormatError("The cross-reference file is empty.")
    assert_licence_header(lines[0])
    for offset, line in enumerate(lines[1:], start=2):
        if line.strip():
            yield _parse_row(line, offset)


def parse_cross_references(text: str) -> list[CrossReferenceRow]:
    """Parse the whole file, de-duplicated on the primary key.

    The published file carries no duplicate ``(from, to_start, to_end)`` triple
    -- measured, all 344,799 rows are distinct -- but the COPY that follows has
    no ON CONFLICT to fall back on, so a future upstream duplicate would abort
    the whole load rather than being dropped. Collapsing here keeps the highest
    vote count, which is the one a reader would have seen on openbible.info.
    """
    best: dict[tuple[int, int, int], CrossReferenceRow] = {}
    for row in iter_cross_references(text):
        identity = (row.from_key, row.to_start_key, row.to_end_key)
        seen = best.get(identity)
        if seen is None or row.votes > seen.votes:
            best[identity] = row
    return list(best.values())
