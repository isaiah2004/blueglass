"""Load the original-language word layer that powers the [Root] badge.

Purpose
    One command turns the licence-verified files in data/raw/ into the lexicon,
    the tagged Greek New Testament, the English-to-Greek alignment and the
    pre-computed usage stats the Root sheet renders. It is a developer tool:
    nothing under app/ imports it.

Licensing
    Every row-set writes its own `data_sources` row carrying licence,
    attribution and retrieval date, and every lexeme, word and alignment points
    at one. AI-05 requires a badge to name its source or not render; the schema
    makes an unsourced definition impossible and this loader makes the strings
    right. All four sources are CC BY 4.0 or CC0 -- no share-alike, so Q-007's
    separability rule is not engaged here.

Scope
    Greek New Testament only. TAHOT, the Hebrew word layer, is NOT among the
    acquired files (data/raw/stepbible/PROVENANCE.md, "Not retrieved"), so the
    Hebrew lexicon loads as headwords with no verse occurrences and the Root
    badge cannot anchor on an Old Testament word. That is a data gap, not a bug.

Usage
    docker compose run --rm api python -m scripts.ingest_lexicon
    docker compose run --rm api python -m scripts.ingest_lexicon --report-only

Idempotence
    Delete-then-COPY inside one transaction, scoped by source id. Re-running
    changes nothing but `loaded_at`, and a failed assertion rolls the whole load
    back rather than leaving a half-loaded corpus nobody can measure.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

import asyncpg

from app.config import get_settings
from scripts.lexicon.alignment_builder import build_alignments
from scripts.lexicon.assertions import Expectations
from scripts.lexicon.lexeme_builder import build_lexicon_rows
from scripts.lexicon.lexeme_parsers import (
    Lexeme,
    parse_dodson_definitions,
    parse_hebrew_strongs,
    parse_tbesg,
)
from scripts.lexicon.provenance import upsert_sources
from scripts.lexicon.sources import (
    ALIGNMENT_SOURCE,
    ALL_SOURCES,
    DODSON_FILE,
    DODSON_LEXICON,
    HEBREW_LEXICON,
    HEBREW_STRONG_FILE,
    TAGNT_FILES,
    TAGNT_GREEK,
    TBESG_FILE,
    TBESG_LEXICON,
    payload_path,
)
from scripts.lexicon.tagnt_parser import (
    TagntWord,
    parse_tagnt_lines,
    renumber_merged_verses,
)
from scripts.lexicon.word_layer_writer import WordLayerPlan, WriteResult, write_word_layer


def read_tagnt_words() -> list[TagntWord]:
    """Parse both TAGNT files, then reconcile them to KJV versification."""
    words: list[TagntWord] = []
    for filename in TAGNT_FILES:
        path = payload_path(TAGNT_GREEK, filename)
        with path.open(encoding="utf-8-sig") as handle:
            words.extend(parse_tagnt_lines(handle))
        print(f"[lexicon] {filename}: {len(words)} words so far", flush=True)
    reconciled, merged = renumber_merged_verses(words)
    print(
        f"[lexicon] {merged} KJV verses take their Greek from two NRSV verses; "
        "their words were renumbered in canonical order",
        flush=True,
    )
    return reconciled


def read_lexemes() -> list[Lexeme]:
    """Parse the Greek and Hebrew headword lists."""
    greek_path = payload_path(TBESG_LEXICON, TBESG_FILE)
    with greek_path.open(encoding="utf-8-sig") as handle:
        lexemes = list(parse_tbesg(handle))
    print(f"[lexicon] TBESG: {len(lexemes)} Greek lexemes", flush=True)
    hebrew = list(parse_hebrew_strongs(payload_path(HEBREW_LEXICON, HEBREW_STRONG_FILE)))
    print(f"[lexicon] HebrewStrong: {len(hebrew)} Hebrew/Aramaic lexemes", flush=True)
    return lexemes + hebrew


def _print_result(result: WriteResult, minted: list[str]) -> None:
    print(
        f"[lexicon] committed: {result.lexemes} lexemes, {result.words} Greek words, "
        f"{result.alignments} alignments, {result.usage_rows} usage rows",
        flush=True,
    )
    if minted:
        print(
            "[lexicon] minted from TAGNT's own dictionary column (absent from "
            f"TBESG): {', '.join(minted)}",
            flush=True,
        )


async def ingest() -> WriteResult:
    """Run the whole pipeline against the configured database."""
    words = read_tagnt_words()
    lexemes = read_lexemes()
    dodson = parse_dodson_definitions(payload_path(DODSON_LEXICON, DODSON_FILE))
    print(f"[lexicon] Dodson: {len(dodson)} definitions", flush=True)
    connection = await asyncpg.connect(dsn=get_settings().dsn)
    try:
        source_ids = await upsert_sources(connection, ALL_SOURCES)
        rows, minted = build_lexicon_rows(lexemes, dodson, words, source_ids)
        alignments, coverage = await build_alignments(connection, words)
        for line in coverage:
            print(
                f"[lexicon] {line.translation}: {line.aligned_tokens} of "
                f"{line.content_tokens} content words aligned "
                f"({line.token_share:.1%}); {line.verses_with_any} of {line.verses} "
                f"verses reachable ({line.verse_share:.1%})",
                flush=True,
            )
        plan = WordLayerPlan(
            lexicon_rows=rows,
            words=words,
            alignments=alignments,
            word_source_id=source_ids[TAGNT_GREEK.key],
            alignment_source_id=source_ids[ALIGNMENT_SOURCE.key],
            expectations=Expectations(
                words=len(words),
                lexemes_at_least=len(rows),
                word_source_id=source_ids[TAGNT_GREEK.key],
                alignment_source_id=source_ids[ALIGNMENT_SOURCE.key],
            ),
        )
        result = await write_word_layer(connection, plan)
    finally:
        await connection.close()
    _print_result(result, minted)
    return result


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load the Greek word layer behind the [Root] badge."
    )
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="parse and measure the files without touching the database",
    )
    return parser.parse_args(argv)


def _report_only() -> int:
    words = read_tagnt_words()
    lexemes = read_lexemes()
    dodson = parse_dodson_definitions(payload_path(DODSON_LEXICON, DODSON_FILE))
    verses = {word.verse_key for word in words}
    strongs = {word.strongs for word in words}
    print(
        f"[lexicon] parsed {len(words)} words across {len(verses)} verses, "
        f"{len(strongs)} distinct Strong's numbers, {len(lexemes)} lexemes, "
        f"{len(dodson)} Dodson definitions. Nothing was written.",
        flush=True,
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    if args.report_only:
        return _report_only()
    asyncio.run(ingest())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
