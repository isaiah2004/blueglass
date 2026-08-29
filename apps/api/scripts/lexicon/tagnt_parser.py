"""Parse STEPBible's TAGNT: one row per word of the Greek New Testament.

Purpose
    Turn 142,096 tab-separated lines into typed rows the loader can COPY. TAGNT
    is not a plain TSV -- roughly a hundred header, legend and per-verse preview
    lines are interleaved with the data -- so the parser recognises data rows by
    the shape of their reference and ignores everything else, rather than
    skipping a fixed number of lines that a future release would move.

The two traps this file exists to absorb
    1. **Versification.** TAGNT numbers verses as NRSV does. Our `verses` table
       is KJV-versified. TAGNT records the difference inline: `[chapter.verse]`
       is the KJV reference, `(...)` the NA one, `{...}` other traditions. 235
       words carry a `[...]`, and applying it is what makes TAGNT's verse set
       land exactly on the 7,957 KJV New Testament verses -- measured, not
       assumed. Ignoring it would file those words one verse off.
    2. **Greek surface form and transliteration share one column**, as
       `Καί (Kai)`. They are split here, once.

Key responsibilities
    Yield `TagntWord` rows. No I/O policy, no database, no counting.

Dependencies
    `step_book_codes`, the scripture domain's verse-key arithmetic.

Usage
    for word in parse_tagnt_lines(handle):
        ...
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass, replace

from app.modules.scripture.domain import verse_key as compose_verse_key

from .step_book_codes import book_number_for_step_code
from .unicode_text import to_nfc, to_nfc_or_none

#: `Act.16.14#01=NKO` and `Rev.12.18[13.1]#01=NKO`. The optional square-bracket
#: group is the KJV reference; round and curly groups are other traditions and
#: are matched only so they cannot break the parse.
_REFERENCE = re.compile(
    r"^(?P<book>[1-3]?[A-Za-z]{2,3})\.(?P<chapter>\d+)\.(?P<verse>\d+)"
    r"(?:\[(?P<kjv_chapter>\d+)\.(?P<kjv_verse>\d+)\])?"
    r"(?:[({][^)}]*[)}])?"
    r"#(?P<index>\d+)(?:=(?P<variant>\S*))?$"
)

#: `Καί (Kai)` -> surface, transliteration.
_SURFACE = re.compile(r"^(?P<surface>.*?)\s*\((?P<translit>[^()]*)\)\s*$")

_MINIMUM_COLUMNS = 12
_COLUMN_GREEK = 1
_COLUMN_ENGLISH = 2
_COLUMN_STRONGS_MORPH = 3
_COLUMN_DICTIONARY = 4
_COLUMN_EDITIONS = 5
_COLUMN_SIMPLE_STRONGS = 11


@dataclass(frozen=True, slots=True)
class TagntWord:
    """One tagged word of the Greek New Testament."""

    verse_key: int
    word_index: int
    surface: str
    translit: str | None
    gloss: str
    strongs: str
    simple_strongs: str
    morph: str | None
    lemma: str | None
    lemma_gloss: str | None
    variant_code: str | None
    editions: str | None


def _split_surface(field: str) -> tuple[str, str | None]:
    """Separate `Καί (Kai)` into its Greek and its transliteration."""
    match = _SURFACE.match(field.strip())
    if match is None:
        return to_nfc(field.strip()), None
    return to_nfc(match.group("surface")), to_nfc_or_none(match.group("translit") or None)


def _split_on_equals(field: str) -> tuple[str, str | None]:
    """Split `G2532=CONJ` or `καί=and` on its first `=`."""
    head, separator, tail = field.partition("=")
    if not separator:
        return head.strip(), None
    return head.strip(), tail.strip() or None


def _resolve_verse_key(match: re.Match[str]) -> int:
    """Compose the KJV verse key, preferring the bracketed KJV reference."""
    book_number = book_number_for_step_code(match.group("book"))
    if match.group("kjv_chapter") is not None:
        chapter = int(match.group("kjv_chapter"))
        verse = int(match.group("kjv_verse"))
    else:
        chapter = int(match.group("chapter"))
        verse = int(match.group("verse"))
    return compose_verse_key(book_number, chapter, verse)


def _word_from_columns(match: re.Match[str], columns: list[str]) -> TagntWord:
    """Build one row from an already-matched reference and its columns."""
    surface, translit = _split_surface(columns[_COLUMN_GREEK])
    strongs, morph = _split_on_equals(columns[_COLUMN_STRONGS_MORPH])
    lemma, lemma_gloss = _split_on_equals(columns[_COLUMN_DICTIONARY])
    simple = columns[_COLUMN_SIMPLE_STRONGS].split("_")[0].strip() or strongs
    return TagntWord(
        verse_key=_resolve_verse_key(match),
        word_index=int(match.group("index")),
        surface=surface,
        translit=translit,
        gloss=columns[_COLUMN_ENGLISH].strip(),
        strongs=strongs,
        simple_strongs=simple,
        morph=morph,
        lemma=to_nfc_or_none(lemma or None),
        lemma_gloss=lemma_gloss,
        variant_code=(match.group("variant") or None),
        editions=columns[_COLUMN_EDITIONS].strip() or None,
    )


def renumber_merged_verses(words: Sequence[TagntWord]) -> tuple[list[TagntWord], int]:
    """Renumber word indexes within each verse, and say how many verses merged.

    Applying the KJV override collapses 32 pairs of adjacent NRSV verses into
    one KJV verse each -- KJV Matthew 17:14 holds the Greek of NRSV 17:14 AND
    17:15, because the two traditions put the verse boundary in different places.
    Both halves then start their word numbering at #01, which collides.

    TAGNT is written in canonical order, so concatenating the halves in file
    order and numbering the result 1..n is the true reading order of the KJV
    verse. For the 7,925 verses that did not merge this is a no-op: they are
    already numbered 1..n. Renumbering unconditionally is what makes it so --
    a special case that only fires on 143 rows would never be exercised.
    """
    counters: dict[int, int] = {}
    merged: set[int] = set()
    renumbered: list[TagntWord] = []
    for word in words:
        position = counters.get(word.verse_key, 0) + 1
        counters[word.verse_key] = position
        if position != word.word_index:
            merged.add(word.verse_key)
        renumbered.append(replace(word, word_index=position))
    return renumbered, len(merged)


def parse_tagnt_lines(lines: Iterable[str]) -> Iterator[TagntWord]:
    """Yield every tagged word in a TAGNT file, ignoring its prose.

    A line that looks like a data row but has too few columns is fatal: a
    silently short row means the file's shape changed, and guessing which column
    moved is how a loader ends up attaching the wrong Strong's number to a word.
    """
    for line in lines:
        if not line or line[0] in "#\t\n\r =":
            continue
        columns = line.rstrip("\n\r").split("\t")
        match = _REFERENCE.match(columns[0])
        if match is None:
            continue
        if len(columns) < _MINIMUM_COLUMNS:
            raise ValueError(
                f"TAGNT row {columns[0]!r} has {len(columns)} columns, "
                f"expected at least {_MINIMUM_COLUMNS}"
            )
        yield _word_from_columns(match, columns)
