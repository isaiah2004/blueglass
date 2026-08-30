"""The row shapes NEUU's Easton/Smith JSON becomes, and nothing else.

Purpose
    Types only, mirroring ``person_rows.py``'s split from its parser. The
    Cultural badge's authored prose (M7, Q-024) needs something citable to
    quote from; these two tables are that citation surface, not the prose.

Key responsibilities
    Define one dataclass per destination table: ``dictionary_entries`` and
    ``dictionary_citations``.

Dependencies
    Standard library only.

Usage
    from scripts.dictionary_rows import DictionaryEntryRow, DictionaryCitationRow
"""

from __future__ import annotations

from dataclasses import dataclass


class DictionaryDataError(RuntimeError):
    """A NEUU dictionary record could not be interpreted."""


@dataclass(frozen=True, slots=True)
class DictionaryEntryRow:
    """One headword from one dictionary.

    ``entry_id`` is ``"<source>:<headword>"`` (e.g. ``"EAS:AARON"``) -- the
    JSON object key is unique within its own source file set (verified: 0
    collisions across all 26 files per dictionary), but ``slug`` is not (2
    Easton entries share the slug "hail"), so the key is what this loader
    treats as the natural id, the same reasoning ``person_rows.PersonRow``
    applies to ``personLookup``.
    """

    entry_id: str
    source: str
    source_name: str
    headword: str
    display_name: str
    slug: str
    definition_text: str


@dataclass(frozen=True, slots=True)
class DictionaryCitationRow:
    """One verse this entry's definition cites.

    Only single-verse and same-chapter-range references become a row here.
    Whole-chapter references ("Leviticus 8"), cross-chapter ranges
    ("Genesis 20:22-23:33") and the small number of malformed sentinel
    references upstream stores as "Book C:0-0;" are not resolvable to one
    ``int4range`` without either guessing a chapter's last verse or a
    versification table this loader has no reason to carry -- they are
    skipped, counted, and reported rather than guessed at, the same choice
    ``osis_refs.parse_osis_range`` makes for a cross-book range it cannot
    expand.
    """

    entry_id: str
    start_key: int
    end_key: int
    raw_reference: str


@dataclass(frozen=True, slots=True)
class DictionaryDataset:
    """Everything one parse of the NEUU files produced."""

    entries: tuple[DictionaryEntryRow, ...]
    citations: tuple[DictionaryCitationRow, ...]
    unresolved_reference_count: int
