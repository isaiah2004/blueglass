"""The 66-book canonical table. Pure data, no I/O, no framework.

Purpose
    One place in the service that knows what a book is. Port-map risk #10: the
    Flutter prototype maps only three books between name and number and writes
    book_number 0 for every other book. That defect is not portable, so this
    table is exhaustive and is checked against the TypeScript twin in
    packages/shared/src/scripture/books.data.ts by a contract test.

Key responsibilities
    - Hold the canon in order with number, name, OSIS code, chapter count and
      testament. Versification is KJV.
    - Expose derived lookup maps built once, at import.

Dependencies
    Standard library only. This module is the innermost layer.

Usage
    from .books import BOOKS, NUMBER_TO_NAME
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Testament = Literal["ot", "nt"]

#: Books in the Protestant canon. Genesis = 1 ... Revelation = 66.
CANONICAL_BOOK_COUNT = 66

#: Chapters in the whole canon, KJV versification. Asserted by a unit test so a
#: typo in a single row cannot pass unnoticed.
CANONICAL_CHAPTER_COUNT = 1189


@dataclass(frozen=True, slots=True)
class Book:
    """One book of the canon."""

    book_number: int
    name: str
    osis: str
    chapter_count: int
    testament: Testament


_ROWS: tuple[tuple[int, str, str, int, Testament], ...] = (
    (1, "Genesis", "Gen", 50, "ot"),
    (2, "Exodus", "Exod", 40, "ot"),
    (3, "Leviticus", "Lev", 27, "ot"),
    (4, "Numbers", "Num", 36, "ot"),
    (5, "Deuteronomy", "Deut", 34, "ot"),
    (6, "Joshua", "Josh", 24, "ot"),
    (7, "Judges", "Judg", 21, "ot"),
    (8, "Ruth", "Ruth", 4, "ot"),
    (9, "1 Samuel", "1Sam", 31, "ot"),
    (10, "2 Samuel", "2Sam", 24, "ot"),
    (11, "1 Kings", "1Kgs", 22, "ot"),
    (12, "2 Kings", "2Kgs", 25, "ot"),
    (13, "1 Chronicles", "1Chr", 29, "ot"),
    (14, "2 Chronicles", "2Chr", 36, "ot"),
    (15, "Ezra", "Ezra", 10, "ot"),
    (16, "Nehemiah", "Neh", 13, "ot"),
    (17, "Esther", "Esth", 10, "ot"),
    (18, "Job", "Job", 42, "ot"),
    (19, "Psalms", "Ps", 150, "ot"),
    (20, "Proverbs", "Prov", 31, "ot"),
    (21, "Ecclesiastes", "Eccl", 12, "ot"),
    (22, "Song of Solomon", "Song", 8, "ot"),
    (23, "Isaiah", "Isa", 66, "ot"),
    (24, "Jeremiah", "Jer", 52, "ot"),
    (25, "Lamentations", "Lam", 5, "ot"),
    (26, "Ezekiel", "Ezek", 48, "ot"),
    (27, "Daniel", "Dan", 12, "ot"),
    (28, "Hosea", "Hos", 14, "ot"),
    (29, "Joel", "Joel", 3, "ot"),
    (30, "Amos", "Amos", 9, "ot"),
    (31, "Obadiah", "Obad", 1, "ot"),
    (32, "Jonah", "Jonah", 4, "ot"),
    (33, "Micah", "Mic", 7, "ot"),
    (34, "Nahum", "Nah", 3, "ot"),
    (35, "Habakkuk", "Hab", 3, "ot"),
    (36, "Zephaniah", "Zeph", 3, "ot"),
    (37, "Haggai", "Hag", 2, "ot"),
    (38, "Zechariah", "Zech", 14, "ot"),
    (39, "Malachi", "Mal", 4, "ot"),
    (40, "Matthew", "Matt", 28, "nt"),
    (41, "Mark", "Mark", 16, "nt"),
    (42, "Luke", "Luke", 24, "nt"),
    (43, "John", "John", 21, "nt"),
    (44, "Acts", "Acts", 28, "nt"),
    (45, "Romans", "Rom", 16, "nt"),
    (46, "1 Corinthians", "1Cor", 16, "nt"),
    (47, "2 Corinthians", "2Cor", 13, "nt"),
    (48, "Galatians", "Gal", 6, "nt"),
    (49, "Ephesians", "Eph", 6, "nt"),
    (50, "Philippians", "Phil", 4, "nt"),
    (51, "Colossians", "Col", 4, "nt"),
    (52, "1 Thessalonians", "1Thess", 5, "nt"),
    (53, "2 Thessalonians", "2Thess", 3, "nt"),
    (54, "1 Timothy", "1Tim", 6, "nt"),
    (55, "2 Timothy", "2Tim", 4, "nt"),
    (56, "Titus", "Titus", 3, "nt"),
    (57, "Philemon", "Phlm", 1, "nt"),
    (58, "Hebrews", "Heb", 13, "nt"),
    (59, "James", "Jas", 5, "nt"),
    (60, "1 Peter", "1Pet", 5, "nt"),
    (61, "2 Peter", "2Pet", 3, "nt"),
    (62, "1 John", "1John", 5, "nt"),
    (63, "2 John", "2John", 1, "nt"),
    (64, "3 John", "3John", 1, "nt"),
    (65, "Jude", "Jude", 1, "nt"),
    (66, "Revelation", "Rev", 22, "nt"),
)

#: The canon, in order.
BOOKS: tuple[Book, ...] = tuple(Book(*row) for row in _ROWS)

BY_NUMBER: dict[int, Book] = {book.book_number: book for book in BOOKS}
NUMBER_TO_NAME: dict[int, str] = {b.book_number: b.name for b in BOOKS}
NUMBER_TO_OSIS: dict[int, str] = {b.book_number: b.osis for b in BOOKS}
