"""Turn one acquired payload into verse rows, or fail loudly.

Purpose
    One place decides which parser a catalogue entry gets and one place asserts
    the count. Both the acquisition script (which measures a freshly downloaded
    file) and the loader (which measures the cached one) go through here, so
    the number written into the manifest and the number asserted at load are
    produced by identical code.

Dependencies
    The two line-format parsers and the catalogue. Pure -- takes text, returns
    rows.

Usage
    rows = parse_rows(CATALOGUE["WEB"], payload)
"""

from __future__ import annotations

from scripts.line_formats import iter_berean_rows, iter_vpl_rows
from scripts.translation_catalogue import BEREAN_TSV, EBIBLE_VPL, TranslationSource
from scripts.verse_rows import VerseRow


class VerseCountMismatch(RuntimeError):
    """The payload did not produce the number of verses the catalogue promises."""


def parse_rows(source: TranslationSource, payload: str) -> list[VerseRow]:
    """Parse a payload into rows. No count checking -- see assert_expected_count."""
    if source.text_format == EBIBLE_VPL:
        rows = iter_vpl_rows(source.code, payload, source.cleanup)
    elif source.text_format == BEREAN_TSV:
        rows = iter_berean_rows(source.code, payload, source.cleanup)
    else:  # pragma: no cover - unreachable while the catalogue is well formed
        raise ValueError(f"{source.code}: unknown text format {source.text_format!r}")
    return list(rows)


def assert_expected_count(source: TranslationSource, rows: list[VerseRow]) -> None:
    """Refuse a partial Bible.

    The prototype's load_more_translations.py had no assertion here at all,
    which is why data-inventory.md section 8 could not say whether ASV and WEB
    had ever loaded. Loudly wrong beats quietly incomplete.
    """
    if len(rows) != source.expected_verses:
        raise VerseCountMismatch(
            f"{source.code}: expected {source.expected_verses} verses, parsed "
            f"{len(rows)}. Refusing to load a partial Bible."
        )


def parse_and_verify(source: TranslationSource, payload: str) -> list[VerseRow]:
    """Parse and assert in one step -- what every caller actually wants."""
    rows = parse_rows(source, payload)
    assert_expected_count(source, rows)
    return rows
