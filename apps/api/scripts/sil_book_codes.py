"""eBible.org's three-letter book codes, mapped to canonical book numbers.

Purpose
    The verse-per-line archives eBible.org publishes label each line with a
    SIL/UBS three-letter code. Several of them differ from the OSIS codes the
    scripture domain already resolves -- SOL not Song, JOE not Joel, EZE not
    Ezek, MAR not Mark, JOH not John, PHI not Phil, JAM not Jas, 1JO not 1John,
    JUD for Jude while JDG is Judges -- so the domain's tolerant alias table
    cannot be relied on here. A wrong guess would file Jude's verses under
    Judges, and the verse count would still come out right.

Key responsibilities
    Map a code to a book number, and refuse anything unrecognised.

Dependencies
    The scripture domain's book table, only to assert this file agrees with it.

Usage
    number = book_number_for_code("3JO")   # 64
"""

from __future__ import annotations

from app.modules.scripture.domain import CANONICAL_BOOK_COUNT

#: In canonical order, so index + 1 IS the book number. Verified against every
#: acquired eBible archive: all three use this exact set, in this exact order.
SIL_CODES_IN_CANONICAL_ORDER: tuple[str, ...] = (
    "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
    "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
    "ECC", "SOL", "ISA", "JER", "LAM", "EZE", "DAN", "HOS", "JOE", "AMO",
    "OBA", "JON", "MIC", "NAH", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT",
    "MAR", "LUK", "JOH", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHI",
    "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAM", "1PE",
    "2PE", "1JO", "2JO", "3JO", "JUD", "REV",
)  # fmt: skip

if len(SIL_CODES_IN_CANONICAL_ORDER) != CANONICAL_BOOK_COUNT:  # pragma: no cover
    raise RuntimeError(
        f"SIL code table has {len(SIL_CODES_IN_CANONICAL_ORDER)} entries, "
        f"canon has {CANONICAL_BOOK_COUNT}"
    )

BOOK_NUMBER_BY_SIL_CODE: dict[str, int] = {
    code: index + 1 for index, code in enumerate(SIL_CODES_IN_CANONICAL_ORDER)
}


def book_number_for_code(code: str) -> int:
    """Resolve an eBible book code, raising rather than guessing.

    The prototype's loader skipped names it could not resolve, which is how it
    ended up with book_number 0 rows. Unresolvable is fatal here.
    """
    try:
        return BOOK_NUMBER_BY_SIL_CODE[code.upper()]
    except KeyError:
        raise ValueError(f"Unknown eBible book code: {code!r}") from None
