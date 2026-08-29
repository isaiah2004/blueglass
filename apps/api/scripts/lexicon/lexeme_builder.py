"""Assemble the `lexicon` row-set from three files and one gap-filler.

Purpose
    Decide, per lexeme, which source supplies the headword and which supplies
    the long definition, and mint rows for the Strong's numbers TAGNT uses that
    no lexicon covers.

The gap this file exists to close
    TAGNT tags its words with 5,580 distinct disambiguated Strong's numbers.
    TBESG keys 11,035 of them -- but five of TAGNT's are not among them:
    G0256, G2453, G3700G, G3700H and G3708, covering 317 words. That is the
    exact failure mode data-inventory.md section 7 predicted ("the FK to lexicon
    catches Strong's numbers that the parser emits but no lexicon covers").
    Rather than drop 317 words or weaken the foreign key, the missing lemmas are
    minted from TAGNT's OWN dictionary-form column (`ὁράω=to see`), attributed
    to TAGNT rather than to TBESG, because that is where they came from.

Dependencies
    The three parsers, and `sources` for the provenance keys. No database.

Usage
    rows = build_lexicon_rows(lexemes, dodson, tagnt_words, source_ids)
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

from .lexeme_parsers import Lexeme
from .sources import DODSON_LEXICON, HEBREW_LEXICON, TAGNT_GREEK, TBESG_LEXICON
from .tagnt_parser import TagntWord


@dataclass(frozen=True, slots=True)
class LexiconRow:
    """A `lexicon` row, with both of its provenance links resolved."""

    strongs: str
    simple_strongs: str
    lang: str
    lemma: str
    translit: str | None
    pos: str | None
    short_gloss: str | None
    definition: str | None
    definition_source_id: int | None
    source_id: int


def _definition_for(
    lexeme: Lexeme, dodson: Mapping[str, str], source_ids: Mapping[str, int]
) -> tuple[str | None, int | None]:
    """Prefer Dodson's plain-text CC0 definition; fall back to the lexeme's own.

    Dodson is keyed by eStrong, so one definition legitimately serves every
    disambiguated number sharing it -- the Strong's entry is the same entry.
    The disambiguation itself survives in `short_gloss`, which stays TBESG's.
    """
    longer = dodson.get(lexeme.simple_strongs)
    if longer:
        return longer, source_ids[DODSON_LEXICON.key]
    if lexeme.definition:
        return lexeme.definition, source_ids[_owner_key(lexeme)]
    return None, None


def _owner_key(lexeme: Lexeme) -> str:
    """Which source published this headword."""
    return TBESG_LEXICON.key if lexeme.lang == "greek" else HEBREW_LEXICON.key


def _row_from_lexeme(
    lexeme: Lexeme, dodson: Mapping[str, str], source_ids: Mapping[str, int]
) -> LexiconRow:
    definition, definition_source_id = _definition_for(lexeme, dodson, source_ids)
    return LexiconRow(
        strongs=lexeme.strongs,
        simple_strongs=lexeme.simple_strongs,
        lang=lexeme.lang,
        lemma=lexeme.lemma,
        translit=lexeme.translit,
        pos=lexeme.pos,
        short_gloss=lexeme.short_gloss,
        definition=definition,
        definition_source_id=definition_source_id,
        source_id=source_ids[_owner_key(lexeme)],
    )


def _minted_from_tagnt(word: TagntWord, source_id: int) -> LexiconRow:
    """A lexeme TBESG does not key, taken from TAGNT's own dictionary column.

    Transliteration and part of speech are left null rather than guessed: TAGNT
    gives the transliteration of the INFLECTED word, not of the headword, and
    writing that into a lemma field would be a small, permanent lie.
    """
    return LexiconRow(
        strongs=word.strongs,
        simple_strongs=word.simple_strongs,
        lang="greek",
        lemma=word.lemma or word.strongs,
        translit=None,
        pos=None,
        short_gloss=word.lemma_gloss,
        definition=None,
        definition_source_id=None,
        source_id=source_id,
    )


def build_lexicon_rows(
    lexemes: Iterable[Lexeme],
    dodson: Mapping[str, str],
    tagnt_words: Sequence[TagntWord],
    source_ids: Mapping[str, int],
) -> tuple[list[LexiconRow], list[str]]:
    """Build every lexicon row. Returns the rows and the minted Strong's numbers."""
    rows = [_row_from_lexeme(lexeme, dodson, source_ids) for lexeme in lexemes]
    known = {row.strongs for row in rows}
    minted: dict[str, LexiconRow] = {}
    for word in tagnt_words:
        if word.strongs in known or word.strongs in minted:
            continue
        minted[word.strongs] = _minted_from_tagnt(word, source_ids[TAGNT_GREEK.key])
    rows.extend(minted.values())
    return rows, sorted(minted)
