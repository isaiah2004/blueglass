"""Parse a Murai verse span into verse keys.

Purpose
    Murai writes spans in eight shapes across four workbooks, and every one of
    them has to land on the ``BBBCCCVVV`` key scheme the rest of the product
    uses. Measured over all 1,959 pericopes and 1,933 structured units, the
    forms that actually occur are:

        ``1:1-11``            a chapter-local range
        ``2:14``              a single verse
        ``3:1-26 4:1-4``      two ranges, space separated
        ``1:1-2:6a``          a range that crosses a chapter boundary
        ``2:1-4a``            a part-verse, lettered a-d
        ``Ac1:1-11``          a book abbreviation, attached
        ``Gen 1:1-2:4a``      a book abbreviation, spaced
        ``1 Sam 4:1-22``      a numbered book abbreviation, spaced

    A ``split()``-based parser handles the first five and silently drops the
    rest, which is how a loader loses 86% of the Old Testament without failing.

Key responsibilities
    - Recognise every range in a cell, with or without a book prefix.
    - Round part-verses (``4a``) to the whole verse they sit in, because the
      verse key scheme has no sub-verse position.
    - Return the ranges AND the outer bounds, since a pericope is stored as one
      ``start_key``/``end_key`` pair.

Dependencies
    Standard library plus the scripture domain's ``verse_key``.

Usage
    span = parse_span("3:1-26 4:1-4", book_number=44)
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass

from app.modules.scripture.domain import verse_key

#: One range, with an optional book abbreviation in front of it. The book group
#: deliberately allows a trailing space and a leading digit so that "1 Sam ",
#: "2Ch" and "Gen " all match; resolving the token to a number is somebody
#: else's job (murai_books.resolve_abbreviation).
_RANGE = re.compile(
    r"(?P<book>(?:[1-3]\s*)?[A-Za-z]{1,6}\.?\s*)?"
    r"(?P<start_chapter>\d{1,3}):(?P<start_verse>\d{1,3})[a-d]?"
    r"(?:\s*-\s*(?:(?P<end_chapter>\d{1,3}):)?(?P<end_verse>\d{1,3})[a-d]?)?"
)


#: Maps a (possibly empty) book abbreviation to a book number.
ResolveBook = Callable[[str], int]


class SpanError(ValueError):
    """A verse span did not parse, or parsed to an impossible range."""


@dataclass(frozen=True, slots=True)
class VerseRange:
    """One contiguous run of verses, inclusive at both ends."""

    book_number: int
    start_key: int
    end_key: int


@dataclass(frozen=True, slots=True)
class Span:
    """Every range in one cell, plus the outer bounds they cover."""

    ranges: tuple[VerseRange, ...]
    start_key: int
    end_key: int

    @property
    def book_number(self) -> int:
        """The book the span opens in. Murai never crosses a book."""
        return self.ranges[0].book_number


def _one_range(match: re.Match[str], book_number: int) -> VerseRange:
    """Build a range from a single regex match, already book-resolved."""
    start_chapter = int(match.group("start_chapter"))
    start_verse = int(match.group("start_verse"))
    end_chapter = int(match.group("end_chapter") or start_chapter)
    end_verse = int(match.group("end_verse") or start_verse)
    start = verse_key(book_number, start_chapter, start_verse)
    end = verse_key(book_number, end_chapter, end_verse)
    if end < start:
        raise SpanError(
            f"span ends before it starts: {start_chapter}:{start_verse}-"
            f"{end_chapter}:{end_verse} in book {book_number}"
        )
    return VerseRange(book_number=book_number, start_key=start, end_key=end)


def parse_span(text: str, book_number: int) -> Span:
    """Parse one span cell. ``book_number`` is the fallback for un-prefixed ranges.

    Raises rather than returning None on a cell that yields no range: an
    unparsed span is a pericope silently missing from the canon, and the whole
    point of this milestone's loaders is that such a loss cannot be silent.
    """
    return parse_span_with(text, lambda _token: book_number)


def parse_span_with(text: str, resolve: ResolveBook) -> Span:
    """Parse one span cell, resolving each range's book abbreviation itself.

    The combined Old Testament sheets ("Samuel" holds both books of Samuel)
    make the abbreviation load-bearing rather than decorative, so the caller
    supplies the resolver and decides what an unknown token means.
    """
    ranges: list[VerseRange] = []
    for match in _RANGE.finditer(text):
        token = (match.group("book") or "").strip()
        ranges.append(_one_range(match, resolve(token)))
    if not ranges:
        raise SpanError(f"no verse range found in {text!r}")
    return Span(
        ranges=tuple(ranges),
        start_key=min(item.start_key for item in ranges),
        end_key=max(item.end_key for item in ranges),
    )
