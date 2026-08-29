"""The committed scripture cache is intact and matches the catalogue.

data-inventory.md section 4 recorded the prototype's worst data risk: nothing
was bundled and both loaders fetched over HTTPS at load time, so a moved
upstream meant no Bible. data/scripture/ removes that risk only for as long as
the files are actually there and actually correct. This test is what keeps that
true -- it runs offline, in milliseconds per file, and fails the moment the
cache and the catalogue disagree.
"""

from __future__ import annotations

import pytest

from scripts.parse_translation import parse_and_verify, parse_rows
from scripts.source_files import (
    PayloadRecord,
    ScriptureDataError,
    cache_file_for,
    load_manifest,
    read_payload,
)
from scripts.translation_catalogue import CATALOGUE

_CODES = sorted(CATALOGUE)


@pytest.fixture(scope="module")
def manifest() -> dict[str, PayloadRecord]:
    """The manifest, or a skip when the data directory is not mounted."""
    try:
        return load_manifest()
    except ScriptureDataError as missing:
        pytest.skip(str(missing))


def test_the_manifest_covers_every_catalogued_translation(
    manifest: dict[str, PayloadRecord],
) -> None:
    assert sorted(manifest) == _CODES


@pytest.mark.parametrize("code", _CODES)
def test_the_cached_payload_exists(code: str) -> None:
    path = cache_file_for(CATALOGUE[code])
    if not path.is_file():
        pytest.skip(f"{path} is not present; run scripts.acquire_sources")

    assert path.stat().st_size > 0


@pytest.mark.parametrize("code", _CODES)
def test_the_payload_hashes_and_parses_to_the_promised_verse_count(
    code: str, manifest: dict[str, PayloadRecord]
) -> None:
    """read_payload raises on a hash mismatch, so reaching the count is the proof."""
    source = CATALOGUE[code]
    if not cache_file_for(source).is_file():
        pytest.skip("payload not acquired")

    rows = parse_and_verify(source, read_payload(source))

    assert len(rows) == manifest[code].expected_verses == source.expected_verses


@pytest.mark.parametrize("code", _CODES)
def test_every_row_carries_both_verse_identities(code: str) -> None:
    """The dual scheme is the join key for every enrichment dataset; a row
    missing either one is unreachable from half the product."""
    source = CATALOGUE[code]
    if not cache_file_for(source).is_file():
        pytest.skip("payload not acquired")

    rows = parse_rows(source, read_payload(source))
    sample = rows[:200] + rows[-200:]

    assert all(row.osis_id.count(".") == 2 for row in sample)
    assert all(
        row.verse_key == row.book_number * 1_000_000 + row.chapter * 1_000 + row.verse
        for row in sample
    )
    assert all(1 <= row.book_number <= 66 for row in sample)
