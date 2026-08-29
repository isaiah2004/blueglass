"""The one filter that keeps third-party Bible text out of this database.

Purpose
    Murai's own analysis is CC BY 4.0, but his spreadsheets quote the New
    American Bible, the NRSV and the New Jerusalem Bible to illustrate each
    node, and the site says so in as many words:

        "Caution: The copyright of the cited Bible verses belongs to each
        translator and publisher."

    Those quotations are not his to license and must never reach the database
    or the client. ``data/raw/murai-literary-structure/PROVENANCE.md`` records
    the carve-out; this module is the carve-out in code.

Key responsibilities
    Decide whether one English cell is Murai's own gloss or a quoted verse, and
    return nothing at all when it is a quotation.

Two things this module knows that the provenance note does not
    1. The QUOTATIONS ARE NOT ONLY LEADING-REFERENCE SHAPED. The Old Testament
       sheets quote in the form ``"a very loud trumpet blast" (19:16)`` -- no
       leading verse number, quotation marks instead. Matching only the
       documented ``1:2 until the day...`` form leaks the whole Pentateuch.
    2. THE JAPANESE COLUMN IS CONTAMINATED THE SAME WAY, with a Japanese
       translation nobody has cleared either. The ingest therefore reads that
       column not at all -- see ``murai_parser`` -- rather than filtering it.

Dependencies
    Standard library only.

Usage
    summary = safe_gloss(cell)      # None when the cell quotes scripture
"""

from __future__ import annotations

import re

#: A verse reference anywhere in the cell -- "1:2 until the day he was taken
#: up (1:2)" and "...trembled" (19:16) both carry one, and Murai's own glosses
#: ("Question of disciples", "A: Being taken up.") never do.
_VERSE_REFERENCE = re.compile(r"\d+\s*:\s*\d+")

#: Every quotation mark the workbooks use. Their presence means the cell is
#: reproducing somebody's translation rather than summarising it.
_QUOTE_MARKS = '"\u201c\u201d\u00ab\u00bb\u300c\u300d\u300e\u300f'


def looks_like_quoted_scripture(text: str) -> bool:
    """True when this cell reproduces a published translation.

    Deliberately over-broad. A dropped gloss costs the reader one line of
    summary; a kept quotation costs the project a licence it does not hold.
    """
    return bool(_VERSE_REFERENCE.search(text)) or any(mark in text for mark in _QUOTE_MARKS)


def safe_gloss(value: object) -> str | None:
    """Murai's own English prose from a cell, or None if it is not his.

    Returns None for blanks too, so a caller stores NULL rather than an empty
    string and the "does this node have a summary?" question has one answer.
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text or looks_like_quoted_scripture(text):
        return None
    return text
