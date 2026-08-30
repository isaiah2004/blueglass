"""Turn NEUU's Easton/Smith JSON into dictionary entries and verse citations.

Purpose
    The Cultural badge's authored prose (M7, Q-024) needs a citable, verse-
    indexed reference to quote from and attribute. ``docs/architecture/
    dataset-validation.md`` section 3.5 ("Option D") recommends Easton and
    Smith over unfoldingWord's ``en_tn`` for exactly this: both are cleared
    USE (CC BY 4.0 dataset over public-domain 19th-century dictionaries),
    where ``en_tn`` is officially NEEDS-DECISION and only 18.7% of its Acts
    notes are culturally informative.

    This loader does not write badge prose. It writes the table the prose is
    authored *against* -- the same division ``theographic_people.py`` draws
    between a graph edge and the sentence a future feature composes from it.

Reference grammar
    NEUU's ``scripture_refs[].reference`` is not OSIS (``osis_refs.py`` does
    not apply): it is a full English book name, a space, then either
    ``C:V``, ``C:V-V2`` (same chapter), a bare chapter ``C``, or a
    cross-chapter range ``C:V-C2:V2``. Measured over both dictionaries'
    56,155 references: 51,205 (91.2%) are ``C:V`` or same-chapter ``C:V-V2``
    and resolve to one ``int4range``; the remainder (whole-chapter references,
    cross-chapter ranges, and roughly a hundred malformed "C:0-0;" sentinel
    values the source itself carries) are not modelled as a citation row --
    guessing a chapter's last verse, or expanding a cross-chapter span,
    would need a versification table this loader has no reason to carry, the
    same restraint ``parse_osis_range`` uses for a range it cannot expand.
    The entry itself is still written either way; only the unresolvable
    reference is dropped, and the count is reported rather than silently lost.

    10 book names in the source are apocryphal (1/2/3 Maccabees, Judith,
    Baruch, Wisdom, 1/2 Esdras, Tobit, Sirach) and do not resolve through
    ``book_number_from_any`` at all -- expected, since the 66-book canon this
    project indexes has no verse_key for them.

Traps
    - 75 entries carry more than one ``definitions[]`` item (multiple
      paragraphs from the same dictionary); they are joined with a blank
      line rather than only the first being kept. 73 entries (all Smith's)
      carry an empty ``definitions[]`` -- a headword and its refs with no
      body text -- and are written with an empty ``definition_text`` rather
      than dropped, since the citations are still real.
    - One Easton slug ("hail") is shared by two distinct entries. The JSON
      object key (the headword, e.g. "HAIL") is unique within a dictionary
      (measured: 0 collisions in both Easton's 3,962 and Smith's 4,561 keys)
      and is what ``entry_id`` is built from, not ``slug``.

Dependencies
    Standard library, the scripture domain's book table, ``raw_datasets``.

Usage
    dataset = read_dictionary()
"""

from __future__ import annotations

import json
import re

from app.modules.scripture.domain import book_number_from_any, verse_key
from scripts.dictionary_rows import (
    DictionaryCitationRow,
    DictionaryDataError,
    DictionaryDataset,
    DictionaryEntryRow,
)
from scripts.raw_datasets import NEUU_BIBLE_DICTIONARY, verify_digest

#: (directory, source code, human name), in the order entries are written.
_SOURCES = (
    ("easton", "EAS", "Easton's Bible Dictionary (1897)"),
    ("smith", "SMI", "Smith's Bible Dictionary (1863)"),
)

#: The 26 per-letter files each dictionary ships (there is no "x").
_LETTERS = "abcdefghijklmnopqrstuvwyz"

_SINGLE_VERSE = re.compile(r"^(.+) (\d+):(\d+)$")
_SAME_CHAPTER_RANGE = re.compile(r"^(.+) (\d+):(\d+)-(\d+)$")


def _resolve_reference(reference: str) -> tuple[int, int] | None:
    """A start/end verse_key pair, or ``None`` if the shape is not modelled.

    Only single verses and same-chapter ranges are attempted; see the module
    docstring for exactly what this intentionally leaves unresolved and why.
    """
    match = _SINGLE_VERSE.match(reference)
    if match:
        book, chapter, verse = match.group(1), int(match.group(2)), int(match.group(3))
        number = book_number_from_any(book)
        if number is None:
            return None
        key = verse_key(number, chapter, verse)
        return key, key

    match = _SAME_CHAPTER_RANGE.match(reference)
    if match:
        book, chapter = match.group(1), int(match.group(2))
        first_verse, last_verse = int(match.group(3)), int(match.group(4))
        if last_verse < first_verse:
            return None
        number = book_number_from_any(book)
        if number is None:
            return None
        return (
            verse_key(number, chapter, first_verse),
            verse_key(number, chapter, last_verse),
        )

    return None


def _definition_text(entry: dict) -> str:
    """Every ``definitions[]`` paragraph, joined for one entry.

    73 of the 8,523 entries (all in Smith's) carry an empty ``definitions``
    list -- a headword with scripture refs but no body text, a gap in the
    upstream parse rather than this loader's. The entry is still written with
    an empty string rather than dropped: it still anchors its citations, and
    a future Cultural author can see the headword exists even with nothing
    to quote from this particular dictionary.
    """
    paragraphs = [str(item["text"]).strip() for item in entry.get("definitions") or ()]
    return "\n\n".join(paragraph for paragraph in paragraphs if paragraph)


def _entry_row(headword: str, entry: dict, source: str, entry_id: str) -> DictionaryEntryRow:
    name = str(entry.get("name") or "").strip()
    slug = str(entry.get("slug") or "").strip()
    if not name or not slug:
        raise DictionaryDataError(f"{entry_id}: missing name or slug.")
    return DictionaryEntryRow(
        entry_id=entry_id,
        source=source,
        source_name=dict((code, name) for _, code, name in _SOURCES)[source],
        headword=headword,
        display_name=name,
        slug=slug,
        definition_text=_definition_text(entry),
    )


def _citations_for(entry_id: str, entry: dict) -> tuple[list[DictionaryCitationRow], int]:
    """Resolvable citations for one entry, and how many references were not."""
    rows: list[DictionaryCitationRow] = []
    unresolved = 0
    for ref in entry.get("scripture_refs") or ():
        reference = str(ref["reference"])
        resolved = _resolve_reference(reference)
        if resolved is None:
            unresolved += 1
            continue
        start, end = resolved
        rows.append(DictionaryCitationRow(entry_id, start, end, reference))
    return rows, unresolved


def read_dictionary() -> DictionaryDataset:
    """Every entry and resolvable citation across both dictionaries."""
    entries: list[DictionaryEntryRow] = []
    citations: list[DictionaryCitationRow] = []
    unresolved_total = 0
    for directory, source, _ in _SOURCES:
        for letter in _LETTERS:
            path = verify_digest(NEUU_BIBLE_DICTIONARY, f"{directory}/{letter}.json")
            with path.open(encoding="utf-8") as handle:
                records = json.load(handle)
            for headword, entry in records.items():
                entry_id = f"{source}:{headword}"
                entries.append(_entry_row(headword, entry, source, entry_id))
                rows, unresolved = _citations_for(entry_id, entry)
                citations.extend(rows)
                unresolved_total += unresolved
    return DictionaryDataset(
        entries=tuple(entries),
        citations=tuple(citations),
        unresolved_reference_count=unresolved_total,
    )
