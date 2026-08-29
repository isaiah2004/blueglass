"""Parse an OSIS reference into the project's integer verse keys.

Purpose
    ``app.modules.scripture.domain`` renders a verse key as OSIS
    (``osis_id_for`` -> ``"John.3.16"``). Ingest needs the inverse: OpenBible
    publishes cross-references as OSIS strings, and 88,150 of the 344,799 rows
    name a RANGE (``1John.4.9-1John.4.10``). One parser, here, keeps the
    book-name tolerance and the range grammar in a single place so two loaders
    cannot drift into resolving "Song" differently.

Key responsibilities
    - Resolve one OSIS verse id to a ``BBBCCCVVV`` key.
    - Resolve an OSIS reference that may be a range to an inclusive key pair.
    - Fail loudly, naming the token, rather than returning a plausible key.

Dependencies
    The scripture domain's book table only. Pure functions, no I/O.

Usage
    start, end = parse_osis_range("1John.4.9-1John.4.10")
"""

from __future__ import annotations

from app.modules.scripture.domain import book_number_from_any, verse_key

#: OpenBible separates the two halves of a range with a plain hyphen. No book
#: name in the Protestant canon contains one, so splitting on it is safe.
RANGE_SEPARATOR = "-"

_PARTS_IN_A_VERSE_ID = 3


class OsisReferenceError(ValueError):
    """An OSIS reference could not be resolved to a verse key."""


def parse_osis_verse(reference: str) -> int:
    """Resolve ``"Acts.16.12"`` to ``44016012``.

    The chapter and verse are parsed with ``int`` rather than a regex so that a
    malformed segment raises here, at the row that carried it, instead of
    becoming a silently wrong key three tables downstream.
    """
    parts = reference.strip().split(".")
    if len(parts) != _PARTS_IN_A_VERSE_ID:
        raise OsisReferenceError(f"{reference!r} is not a Book.Chapter.Verse reference.")
    book_number = book_number_from_any(parts[0])
    if book_number is None:
        raise OsisReferenceError(f"{reference!r} names an unknown book: {parts[0]!r}.")
    try:
        chapter, verse = int(parts[1]), int(parts[2])
    except ValueError:
        raise OsisReferenceError(
            f"{reference!r} has a non-numeric chapter or verse."
        ) from None
    return verse_key(book_number, chapter, verse)


def parse_osis_range(reference: str) -> tuple[int, int]:
    """Resolve a reference that may be a range to an inclusive ``(start, end)``.

    A single verse yields ``(key, key)``. Storing both endpoints rather than
    expanding the range keeps the published shape intact: 637 of the ranges
    cross a chapter boundary and 18 cross a book boundary, and expanding those
    would need a versification table the cross-reference file does not carry.
    """
    if RANGE_SEPARATOR not in reference:
        key = parse_osis_verse(reference)
        return key, key
    first, separator, last = reference.partition(RANGE_SEPARATOR)
    if not separator or not last:
        raise OsisReferenceError(f"{reference!r} is a range with no end.")
    start, end = parse_osis_verse(first), parse_osis_verse(last)
    if end < start:
        raise OsisReferenceError(f"{reference!r} ends before it starts.")
    return start, end
