"""Parsers for the two verse-per-line scripture formats we load.

Purpose
    Both publishers ship one verse per line, which is the least ambiguous
    scripture format there is: no markup to mis-handle, no nesting, and a line
    count that can be compared against a known verse count before anything is
    parsed. The two differ only in how the reference is written.

        eBible VPL   GEN 1:1 In the beginning, God created...
        Berean TSV   Genesis 1:1<TAB>In the beginning God created...

Key responsibilities
    Turn a decoded payload into VerseRows, raising on anything unexpected. A
    line that cannot be parsed is fatal: a parser that skips what it does not
    understand is how a Bible loses four verses without anyone noticing.

Dependencies
    The scripture domain (book lookup) and the sibling row/code modules. Pure
    functions -- these take text, not paths, so they are testable from fixtures
    with no network and no database.

Usage
    rows = list(iter_vpl_rows("KJV", payload, KJV_CLEANUP))
"""

from __future__ import annotations

from collections.abc import Iterator

from app.modules.scripture.domain import book_number_from_any
from scripts.sil_book_codes import book_number_for_code
from scripts.verse_rows import VERBATIM, TextCleanup, VerseRow, build_row

#: The Berean file opens with an attribution paragraph, a public-domain notice
#: and this column header. Anchoring on the header rather than "skip 3 lines"
#: means a changed preamble fails loudly instead of eating Genesis 1:1.
_BEREAN_HEADER_FIRST_FIELD = "Verse"


def _split_chapter_verse(token: str, line: str) -> tuple[int, int]:
    """Parse "3:16" into (3, 16)."""
    chapter, separator, verse = token.partition(":")
    if not separator or not chapter.isdigit() or not verse.isdigit():
        raise ValueError(f"Malformed chapter:verse {token!r} in line: {line!r}")
    return int(chapter), int(verse)


def iter_vpl_rows(
    translation: str, payload: str, cleanup: TextCleanup = VERBATIM
) -> Iterator[VerseRow]:
    """Rows from an eBible.org verse-per-line payload.

    Empty verses -- the critical text's deliberate omissions -- yield nothing,
    which is why the caller's expected count is below the line count.
    """
    for line in payload.splitlines():
        if not line.strip():
            continue
        parts = line.split(" ", 2)
        if len(parts) < 2:
            raise ValueError(f"Malformed verse-per-line record: {line!r}")
        code, reference = parts[0], parts[1]
        chapter, verse = _split_chapter_verse(reference, line)
        row = build_row(
            translation,
            book_number_for_code(code),
            chapter,
            verse,
            parts[2] if len(parts) == 3 else "",
            cleanup,
        )
        if row is not None:
            yield row


def _berean_body(payload: str) -> Iterator[str]:
    """The verse lines, with the file's three-line preamble consumed."""
    lines = payload.splitlines()
    for index, line in enumerate(lines):
        if line.split("\t", 1)[0].strip() == _BEREAN_HEADER_FIRST_FIELD:
            yield from lines[index + 1 :]
            return
    raise ValueError(
        f"Berean payload has no {_BEREAN_HEADER_FIRST_FIELD!r} header row; "
        "the file layout changed and the preamble would be parsed as scripture."
    )


def _berean_reference(reference: str, line: str) -> tuple[int, int, int]:
    """Parse "1 Samuel 17:45" into (book_number, chapter, verse)."""
    book_name, separator, chapter_verse = reference.rpartition(" ")
    if not separator:
        raise ValueError(f"Malformed Berean reference {reference!r} in line: {line!r}")
    book_number = book_number_from_any(book_name)
    if book_number is None:
        raise ValueError(f"Unresolved book name {book_name!r} in line: {line!r}")
    chapter, verse = _split_chapter_verse(chapter_verse, line)
    return book_number, chapter, verse


def iter_berean_rows(
    translation: str, payload: str, cleanup: TextCleanup = VERBATIM
) -> Iterator[VerseRow]:
    """Rows from the official bereanbible.com tab-separated payload."""
    for line in _berean_body(payload):
        if not line.strip():
            continue
        reference, separator, text = line.partition("\t")
        if not separator:
            raise ValueError(f"Berean record has no tab separator: {line!r}")
        book_number, chapter, verse = _berean_reference(reference, line)
        row = build_row(
            translation,
            book_number,
            chapter,
            verse,
            text,
            cleanup,
        )
        if row is not None:
            yield row
