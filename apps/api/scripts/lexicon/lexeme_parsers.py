"""Parse the three lexicons: TBESG (Greek), Dodson (Greek), OSHB (Hebrew).

Purpose
    Produce `Lexeme` rows for the `lexicon` table. Each parser knows one file
    format and nothing about the database.

The facts these parsers encode, each verified against the retrieved file
    - **TBESG is keyed three ways.** Columns are eStrong, dStrong, uStrong,
      Greek, transliteration, morph, gloss, definition. TAGNT tags words with
      the DISAMBIGUATED number (`G1135G`), so the dStrong column -- not the
      first column -- is the join key. Its cell reads `G0001G = a Name of`, so
      the number must be taken before the `=`. Measured: 11,035 rows, 11,035
      distinct dStrongs, no duplicates.
    - **TBESG definitions are HTML.** `<b>`, `<BR />` and `<ref='Act.16.14'>`
      markup is stripped here; a sheet must not render another site's markup.
    - **Dodson's Greek is Beta Code, not Unicode** (`a)/lfa` is ἄλφα), so only
      its English definition is taken. The Greek headword comes from TBESG.
      Its keys are zero-padded and unprefixed (`0001`), and they are eStrongs,
      so one Dodson definition serves every dStrong sharing that eStrong.
    - **OSHB marks Aramaic separately** in `xml:lang`: 5,393 `heb`, 2,628
      `x-pn` (proper nouns, Hebrew) and 653 `arc` (Aramaic) of 8,674 entries.
      239 entries have no `<meaning>`; `<usage>` carries the KJV renderings.

Dependencies
    Standard library only.

Usage
    lexemes = list(parse_tbesg(handle))
"""

from __future__ import annotations

import csv
import re
import xml.etree.ElementTree as ElementTree
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path

from .unicode_text import to_nfc

_OSHB_NS = "{http://openscriptures.github.com/morphhb/namespace}"
_XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"
_LANG_BY_OSHB_CODE = {"heb": "hebrew", "x-pn": "hebrew", "arc": "aramaic"}

_TAG = re.compile(r"<[^>]+>")
_WHITESPACE = re.compile(r"\s+")
_TBESG_COLUMNS = 8


@dataclass(frozen=True, slots=True)
class Lexeme:
    """One dictionary headword, keyed by its disambiguated Strong's number."""

    strongs: str
    simple_strongs: str
    lang: str
    lemma: str
    translit: str | None
    pos: str | None
    short_gloss: str | None
    definition: str | None


def strip_markup(html: str) -> str:
    """Remove the lexicon's inline HTML and collapse the whitespace it left."""
    return _WHITESPACE.sub(" ", _TAG.sub(" ", html)).strip()


def parse_tbesg(lines: Iterable[str]) -> Iterator[Lexeme]:
    """Yield every Greek lexeme, keyed on the disambiguated Strong's number."""
    for line in lines:
        if not line.startswith("G") or "\t" not in line:
            continue
        columns = line.rstrip("\n\r").split("\t")
        if len(columns) < _TBESG_COLUMNS:
            continue
        disambiguated = columns[1].partition("=")[0].strip()
        if not disambiguated:
            continue
        definition = strip_markup(columns[7])
        yield Lexeme(
            strongs=disambiguated,
            simple_strongs=columns[0].strip(),
            lang="greek",
            lemma=to_nfc(columns[3].strip()),
            translit=to_nfc(columns[4].strip()) or None,
            pos=columns[5].strip() or None,
            short_gloss=columns[6].strip() or None,
            definition=definition or None,
        )


def parse_dodson_definitions(path: Path) -> dict[str, str]:
    """Map `G0001` to Dodson's longer English definition.

    The file is tab-separated despite its `.csv` extension and every field is
    double-quoted, so it needs the csv module rather than a `split("\\t")`.
    """
    definitions: dict[str, str] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t", quotechar='"')
        next(reader, None)
        for row in reader:
            if len(row) < 5 or not row[0].strip():
                continue
            longer = row[4].strip() or row[3].strip()
            if longer:
                definitions[f"G{row[0].strip()}"] = longer
    return definitions


def _oshb_text(entry: ElementTree.Element, tag: str) -> str | None:
    """Flatten one child element's text, including its nested `<def>` markup."""
    element = entry.find(_OSHB_NS + tag)
    if element is None:
        return None
    return _WHITESPACE.sub(" ", "".join(element.itertext())).strip() or None


def parse_hebrew_strongs(path: Path) -> Iterator[Lexeme]:
    """Yield every Strong's Hebrew/Aramaic entry from HebrewStrong.xml.

    An entry whose `xml:lang` is unknown is fatal rather than defaulted: the
    only three values in the file are known, and silently calling an Aramaic
    word Hebrew would put the wrong script direction on the reader's screen.
    """
    root = ElementTree.parse(path).getroot()  # noqa: S314 - local, licence-verified file
    for entry in root.findall(_OSHB_NS + "entry"):
        identifier = entry.get("id")
        word = entry.find(_OSHB_NS + "w")
        if identifier is None or word is None or not (word.text or "").strip():
            continue
        code = word.get(_XML_LANG) or ""
        if code not in _LANG_BY_OSHB_CODE:
            raise ValueError(f"{identifier}: unknown xml:lang {code!r}")
        meaning = _oshb_text(entry, "meaning")
        usage = _oshb_text(entry, "usage")
        yield Lexeme(
            strongs=normalise_hebrew_strongs(identifier),
            simple_strongs=normalise_hebrew_strongs(identifier),
            lang=_LANG_BY_OSHB_CODE[code],
            lemma=to_nfc((word.text or "").strip()),
            translit=to_nfc(word.get("xlit") or "") or None,
            pos=word.get("pos"),
            short_gloss=meaning,
            definition=usage,
        )


def normalise_hebrew_strongs(identifier: str) -> str:
    """`H1` -> `H0001`, matching the four-digit form used everywhere else."""
    digits = identifier[1:]
    return f"H{int(digits):04d}" if digits.isdigit() else identifier
