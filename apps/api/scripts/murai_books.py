"""Resolve a Murai worksheet, and a span's book prefix, to a book number.

Purpose
    Murai's workbooks hold 62 sheets, not 66, because four of them combine two
    canonical books each: "Samuel", "Kings", "Chronicles" and "Ezra-Nehemiah".
    Inside those sheets the book abbreviation on each span is the only thing
    that says whether ``4:1-22`` is 1 Samuel or 2 Samuel. A loader that reads
    the sheet name alone files half of Samuel, Kings and Chronicles under the
    wrong book -- 511 pericopes' worth, silently.

    Two sheet names also do not resolve through the API's tolerant book lookup:
    "Lamentation" (canonically "Lamentations") and "SongofSolomon".

Key responsibilities
    - Map a sheet name to the book it holds, or to the pair it combines.
    - Map an abbreviation inside a combined sheet to one of that pair.
    - Fail loudly on anything unrecognised, rather than guessing.

Dependencies
    The scripture domain's book lookup. No I/O.

Usage
    sheet = require_sheet("Samuel")
    number = sheet.resolve("2S")      # -> 10
"""

from __future__ import annotations

from dataclasses import dataclass

from app.modules.scripture.domain.book_lookup import book_number_from_any, normalise_token


class SheetError(KeyError):
    """A worksheet or a span's book prefix could not be resolved."""


#: Sheet names the tolerant lookup does not already cover.
_SHEET_ALIASES: dict[str, str] = {
    "lamentation": "Lamentations",
    "songofsolomon": "Song of Solomon",
}

#: The four combined sheets, and the abbreviations Murai uses inside each.
#: Transcribed from the retrieved workbooks, not guessed: every abbreviation
#: below was observed at least once in the 2022-02-24 files.
_COMBINED: dict[str, dict[str, int]] = {
    "samuel": {"1s": 9, "1sam": 9, "1samuel": 9, "2s": 10, "2sam": 10, "2samuel": 10},
    "kings": {"1k": 11, "1kgs": 11, "1kings": 11, "2k": 12, "2kgs": 12, "2kings": 12},
    "chronicles": {
        "1ch": 13,
        "1chr": 13,
        "1chronicles": 13,
        "2ch": 14,
        "2chr": 14,
        "2chronicles": 14,
    },
    "ezranehemiah": {"ezr": 15, "ezra": 15, "ne": 16, "neh": 16, "nehemiah": 16},
}


@dataclass(frozen=True, slots=True)
class MuraiSheet:
    """One worksheet, and how to decide which book a span in it belongs to."""

    name: str
    #: The book every un-prefixed span in this sheet belongs to.
    default_book: int
    #: Abbreviation -> book number, non-empty only for the four combined sheets.
    members: dict[str, int]

    @property
    def is_combined(self) -> bool:
        """True when the sheet holds more than one canonical book."""
        return bool(self.members)

    def resolve(self, abbreviation: str) -> int:
        """Which book this span belongs to, given its (possibly empty) prefix.

        In a single-book sheet the prefix is decoration and is ignored -- the
        abbreviations there are inconsistent ("Ac" and "Act" both appear in
        Acts) and the sheet name is authoritative. In a combined sheet the
        prefix is the only signal, so an unrecognised one is fatal.
        """
        if not self.is_combined:
            return self.default_book
        token = normalise_token(abbreviation)
        if not token:
            raise SheetError(
                f"sheet {self.name!r} combines two books, so a span with no book "
                "prefix cannot be placed"
            )
        number = self.members.get(token)
        if number is None:
            raise SheetError(
                f"unknown book abbreviation {abbreviation!r} in sheet {self.name!r}; "
                f"expected one of {sorted(set(self.members))}"
            )
        return number


def require_sheet(name: str) -> MuraiSheet:
    """Resolve a worksheet name, or raise.

    Raising is the point. A new edition of the workbooks that renames or adds a
    sheet must stop the load, not quietly ingest 61 books.
    """
    token = normalise_token(name)
    members = _COMBINED.get(token)
    if members is not None:
        return MuraiSheet(name=name, default_book=min(members.values()), members=members)
    number = book_number_from_any(_SHEET_ALIASES.get(token, name))
    if number is None:
        raise SheetError(f"unknown Murai worksheet: {name!r}")
    return MuraiSheet(name=name, default_book=number, members={})
