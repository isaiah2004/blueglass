"""STEPBible's three-letter New Testament book codes.

Purpose
    TAGNT labels every word with a code that is neither OSIS nor the SIL codes
    scripts/sil_book_codes.py already resolves: `Mrk` not `Mark` or `MAR`, `Jhn`
    not `John` or `JOH`, `Php` not `Phil`, `Jud` for Jude. Port-map risk #10 was
    a loader that filed verses under the wrong book and still counted right, so
    this table is exhaustive and an unknown code is fatal rather than skipped.

Key responsibilities
    Map a STEPBible NT book code to a canonical book number, and refuse anything
    it does not know.

Dependencies
    The scripture domain's book table, only to assert this file agrees with it.

Usage
    number = book_number_for_step_code("Act")   # 44
"""

from __future__ import annotations

from app.modules.scripture.domain import BY_NUMBER

#: In canonical order, so index + 40 IS the book number. Verified against both
#: acquired TAGNT files: they use this exact set and nothing else.
STEP_NT_CODES_IN_CANONICAL_ORDER: tuple[str, ...] = (
    "Mat", "Mrk", "Luk", "Jhn", "Act", "Rom", "1Co", "2Co", "Gal", "Eph",
    "Php", "Col", "1Th", "2Th", "1Ti", "2Ti", "Tit", "Phm", "Heb", "Jas",
    "1Pe", "2Pe", "1Jn", "2Jn", "3Jn", "Jud", "Rev",
)  # fmt: skip

FIRST_NT_BOOK_NUMBER = 40
NT_BOOK_COUNT = 27

if len(STEP_NT_CODES_IN_CANONICAL_ORDER) != NT_BOOK_COUNT:  # pragma: no cover
    raise RuntimeError(
        f"STEPBible NT code table has {len(STEP_NT_CODES_IN_CANONICAL_ORDER)} "
        f"entries, the New Testament has {NT_BOOK_COUNT}"
    )

BOOK_NUMBER_BY_STEP_CODE: dict[str, int] = {
    code: FIRST_NT_BOOK_NUMBER + index
    for index, code in enumerate(STEP_NT_CODES_IN_CANONICAL_ORDER)
}

if any(number not in BY_NUMBER for number in BOOK_NUMBER_BY_STEP_CODE.values()):
    raise RuntimeError(  # pragma: no cover
        "STEPBible code table maps to a book number the canon does not contain"
    )


def book_number_for_step_code(code: str) -> int:
    """Resolve a STEPBible book code, raising rather than guessing."""
    try:
        return BOOK_NUMBER_BY_STEP_CODE[code]
    except KeyError:
        raise ValueError(f"Unknown STEPBible book code: {code!r}") from None
