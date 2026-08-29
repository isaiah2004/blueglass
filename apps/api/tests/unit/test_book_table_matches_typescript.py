"""The Python canon and the TypeScript canon must agree, row for row.

Why this test exists
    There are now two book tables in the repository: this service's
    app/modules/scripture/domain/books.py and the client's
    packages/shared/src/scripture/books.data.ts. Two languages means two
    tables -- there is no way around that -- but it must never mean two
    ANSWERS. A book number that differs by one between client and server
    corrupts every verse key, every highlight and every note that crosses the
    wire, and it does so silently.

    So the TypeScript file is parsed and compared. If either table is edited
    alone, this fails.

Skips
    packages/shared is bind-mounted read-only into the API container and is
    present in the build context. If somebody runs pytest from a checkout
    without it, the test skips rather than failing for the wrong reason.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.modules.scripture.domain import BOOKS

_TS_TABLE = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "shared"
    / "src"
    / "scripture"
    / "books.data.ts"
)

# [1, 'Genesis', 'Gen', 50, 'ot'],
_ROW = re.compile(
    r"\[\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*'(ot|nt)'\s*\]"
)


def _typescript_rows() -> list[tuple[int, str, str, int, str]]:
    source = _TS_TABLE.read_text(encoding="utf-8")
    body = source.split("const BOOK_ROWS", 1)[1]
    return [
        (int(number), name, osis, int(chapters), testament)
        for number, name, osis, chapters, testament in _ROW.findall(body)
    ]


def test_the_two_canonical_tables_are_identical() -> None:
    if not _TS_TABLE.exists():
        pytest.skip(f"{_TS_TABLE} is not present in this checkout.")

    typescript = _typescript_rows()
    python = [(b.book_number, b.name, b.osis, b.chapter_count, b.testament) for b in BOOKS]

    assert typescript == python
