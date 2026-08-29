"""The row shape every scripture parser produces, and how one is built.

Purpose
    Three source formats feed one table. Putting the row type and its single
    construction path here means the verse-key arithmetic, the OSIS id and the
    text normalisation happen in exactly one place, so two parsers cannot drift
    into producing subtly different rows.

Dependencies
    The scripture domain only -- verse_key and osis_id_for. No I/O.

Usage
    row = build_row("KJV", 43, 3, 16, "For God so loved...", cleanup=KJV_CLEANUP)
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from app.modules.scripture.domain import osis_id_for, verse_key

#: eBible.org renders the translators' supplied words -- set in italics in a
#: printed Bible -- as [square brackets]. Removing the two characters leaves
#: every word intact and gives the reader prose instead of markup.
_SUPPLIED_WORD_BRACKETS = str.maketrans("", "", "[]")

#: The KJV's traditional paragraph mark. It opens 2,970 verses in the eBible
#: edition and appears in none of the other translations. It is typography, not
#: scripture: rendered inline it reads as stray markup, and left in place it
#: would also land in the full-text index. Dropping it loses the KJV's
#: paragraph structure, which the verses table has nowhere to store -- recorded
#: in data/scripture/PROVENANCE.md as a known, deliberate loss.
_PARAGRAPH_MARKS = str.maketrans("", "", "¶")


@dataclass(frozen=True, slots=True)
class TextCleanup:
    """Which publisher-specific typographic marks to remove.

    Every field defaults to False so a new translation is loaded verbatim until
    somebody deliberately decides otherwise. That default matters for the World
    English Bible, whose licence permits every use of the text but forbids
    calling an ALTERED text the World English Bible.
    """

    strip_supplied_brackets: bool = False
    strip_paragraph_marks: bool = False


#: Load the text exactly as published.
VERBATIM = TextCleanup()


@dataclass(frozen=True, slots=True)
class VerseRow:
    """One row destined for the verses table."""

    verse_key: int
    translation: str
    book_number: int
    chapter: int
    verse: int
    osis_id: str
    text: str


def normalise_text(text: str, cleanup: TextCleanup = VERBATIM) -> str:
    """Clean one verse's text without changing a single word.

    Three things happen and nothing else:
      - NFC normalisation, so the curly apostrophes the WEB and BSB use compare
        and search identically however the publisher encoded them;
      - removal of the marks the cleanup asks for;
      - whitespace collapse, because removing a mark leaves the space beside it.

    No word is added, removed or reordered by any of it.
    """
    cleaned = unicodedata.normalize("NFC", text)
    if cleanup.strip_supplied_brackets:
        cleaned = cleaned.translate(_SUPPLIED_WORD_BRACKETS)
    if cleanup.strip_paragraph_marks:
        cleaned = cleaned.translate(_PARAGRAPH_MARKS)
    return " ".join(cleaned.split())


def build_row(
    translation: str,
    book_number: int,
    chapter: int,
    verse: int,
    text: str,
    cleanup: TextCleanup = VERBATIM,
) -> VerseRow | None:
    """Build one row, or None when the source verse carries no text.

    A verse with no text is not an error: the critical-text translations print
    Matthew 17:21 as an empty verse on purpose. It must not become a blank line
    in the reader, so it is dropped here rather than stored empty -- and the
    catalogue's expected_verses count is the count AFTER those drops, which is
    what makes the drop auditable instead of silent.
    """
    cleaned = normalise_text(text, cleanup)
    if not cleaned:
        return None
    return VerseRow(
        verse_key=verse_key(book_number, chapter, verse),
        translation=translation,
        book_number=book_number,
        chapter=chapter,
        verse=verse,
        osis_id=osis_id_for(book_number, chapter, verse),
        text=cleaned,
    )
