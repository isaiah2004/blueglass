"""Separate what a reader should see from OpenBible's homonym bookkeeping.

Purpose
    OpenBible's ``friendly_id`` is an *identifier*, not a label. Where several
    places share a name it disambiguates them with a trailing ordinal --
    "Ramah 1" .. "Ramah 9", "Achzib 1", "Antioch 2". Measured on the acquired
    file: 315 of the 1,342 ancient records carry one. Printing that ordinal
    beside scripture asserts something the text does not say -- no Bible calls
    anywhere "Ramah 2" -- which is the class of claim pillar 3 forbids.

    Stripping the ordinal and stopping there would be a worse bug: nine
    different towns would collapse into nine identical labels with no way to
    tell them apart. So the ordinal is *moved*, not deleted:

        name                 the reader-facing label, "Ramah"
        disambiguation_index OpenBible's ordinal, 1..9, retained verbatim
        homonym_count        how many places share this name, 1 when unique
        disambiguation       OpenBible's own prose note, as plain text

    ``slug`` already holds the source form ("ramah-2"), so name + index is a
    lossless round-trip back to ``friendly_id``.

Key responsibilities
    - Split a published ``friendly_id`` into its label and its ordinal.
    - Count how many places end up sharing each label.
    - Reduce OpenBible's HTML ``comment`` to renderable plain text.

Dependencies
    Standard library only. No I/O, no database, no model.

Usage
    label, index = split_display_name("Ramah 2")     # ("Ramah", 2)
    counts = homonym_counts(labels)                  # {"Ramah": 9, ...}
    note = plain_text_note('in <ancient id="a1">Syria</ancient>')  # "in Syria"
"""

from __future__ import annotations

import html
import re
from collections import Counter
from collections.abc import Iterable

#: A trailing ordinal on a published place name: a space, then digits, at the
#: very end. Bounded to three digits because it is a homonym counter -- the
#: largest observed is 9 (Ramah) -- and an unbounded \d+ would also match a
#: genuine name that happens to end in a long number.
#:
#: The pattern requires a non-space before the separator, so a name that is
#: nothing but digits is left alone rather than reduced to the empty string.
_TRAILING_INDEX = re.compile(r"^(?P<label>.*\S) (?P<index>\d{1,3})$")

#: Any HTML element. OpenBible's `comment` field is authored as HTML: it wraps
#: place references in <ancient id="..."> / <modern id="..."> and cites sources
#: with <a href>. Measured on the acquired file: 275 records carry a comment,
#: the longest is 1,023 characters, and 141 of them contain markup. The tags are
#: dropped rather than rendered because the text is a label beside a place
#: name, not a document -- and a badge that printed raw <a href> would be the
#: same class of failure as printing the ordinal.
_TAG = re.compile(r"<[^>]+>")

#: Runs of whitespace left behind once the tags are gone.
_WHITESPACE = re.compile(r"\s+")

#: What SQL must never find in `places.name` again. Kept here beside the
#: pattern that produces the name so the check and the fix cannot drift; the
#: same expression is the CHECK constraint in migration 0008.
NAME_INDEX_SQL_PATTERN = " [0-9]+$"


def split_display_name(friendly_id: str) -> tuple[str, int | None]:
    """Split a published id into the label a reader sees and its ordinal.

    Args:
        friendly_id: OpenBible's ``friendly_id``, e.g. ``"Ramah 2"``.

    Returns:
        ``(label, index)``. ``index`` is ``None`` when the source published no
        ordinal, which is the case for 1,027 of the 1,342 places.

    The ordinal is *only* stripped from this field. It is deliberately not
    stripped from modern site names: "Feldstein et al Site 43" is a real
    archaeological site name in ``modern.jsonl``, and folding it to
    "Feldstein et al Site" would invent a name nobody uses.
    """
    match = _TRAILING_INDEX.match(friendly_id.strip())
    if match is None:
        return friendly_id.strip(), None
    return match.group("label"), int(match.group("index"))


def homonym_counts(labels: Iterable[str]) -> dict[str, int]:
    """Count how many places answer to each label.

    Args:
        labels: every display name in the dataset, including repeats.

    Returns:
        Label -> number of places carrying it. A count above 1 is the honest
        signal a sheet needs: it means the name alone does not identify the
        place, so the sheet must say so rather than pick one silently
        (DECISIONS #10). Measured: 129 labels are shared, covering 312 places.
    """
    return dict(Counter(labels))


def plain_text_note(comment: object) -> str | None:
    """Reduce OpenBible's HTML ``comment`` to text a badge can render.

    Args:
        comment: the raw ``comment`` field, which is HTML, or anything falsy.

    Returns:
        The note as plain text with entities resolved and whitespace collapsed,
        or ``None`` when there is nothing to show. Tags are removed, never
        escaped and shown.

    This note is what actually tells two homonyms apart in the source's own
    words -- "in Judah" against "in Asher" for the two Achzibs. It is never
    invented: 203 of the 312 shared-name places have no comment, and those
    stay ``None`` rather than receiving a guess.
    """
    if not isinstance(comment, str):
        return None
    text = _WHITESPACE.sub(" ", html.unescape(_TAG.sub("", comment))).strip()
    return text or None
