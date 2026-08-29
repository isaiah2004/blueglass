"""Download the public-domain scripture files into data/scripture/.

This is the ONLY script in the repository that fetches scripture over the
network, and it is run rarely -- when a translation is added or a publisher
issues a new edition. Everything downstream reads the committed cache, so a
seed works offline and a vanished upstream cannot cost us a Bible.

Usage
    docker compose run --rm api python -m scripts.acquire_sources --all
    docker compose run --rm api python -m scripts.acquire_sources BSB

    The data/ mount is read-only in the api service, so run this with a
    writable mount or from a host checkout with ATLAS_SCRIPTURE_DATA_DIR set.

What it writes
    data/scripture/sources/<payload>.gz   the exact bytes the publisher served,
                                          gzipped; nothing is edited on the way
    data/scripture/manifest.json          size, SHA-256, measured verse count
                                          and licence for each translation

The verse count in the manifest is MEASURED by running the real parser over the
freshly downloaded bytes, then cross-checked against the catalogue. A publisher
who quietly changes an edition therefore fails here, not in production.
"""

from __future__ import annotations

import argparse
import gzip
import io
import json
import sys
import zipfile
from datetime import date
from pathlib import Path

import httpx

from scripts.parse_translation import parse_rows
from scripts.source_files import SOURCES_DIRNAME, scripture_data_dir, sha256_of
from scripts.translation_catalogue import CATALOGUE, TranslationSource, require_source

_TIMEOUT_SECONDS = 300


def _download(source: TranslationSource) -> bytes:
    """Fetch the upstream artefact and return the scripture payload bytes."""
    with httpx.Client(timeout=_TIMEOUT_SECONDS, follow_redirects=True) as client:
        response = client.get(source.download_url)
        response.raise_for_status()
        body = response.content
    if source.archive_member is None:
        return body
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        return archive.read(source.archive_member)


def _write_cache(source: TranslationSource, payload: bytes) -> Path:
    """Gzip the payload into data/scripture/sources/, creating it if needed."""
    directory = scripture_data_dir() / SOURCES_DIRNAME
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{source.payload_name}.gz"
    # mtime=0 keeps the gzip header byte-identical between runs, so re-acquiring
    # an unchanged file produces no diff.
    path.write_bytes(gzip.compress(payload, mtime=0))
    return path


def _manifest_entry(source: TranslationSource, payload: bytes, verses: int) -> dict:
    """One manifest record. Licence fields are duplicated here on purpose: the
    manifest must be readable on its own, without importing Python."""
    return {
        "name": source.name,
        "payload_name": source.payload_name,
        "cache_file": f"{SOURCES_DIRNAME}/{source.payload_name}.gz",
        "download_url": source.download_url,
        "archive_member": source.archive_member,
        "text_format": source.text_format,
        "payload_bytes": len(payload),
        "payload_sha256": sha256_of(payload),
        "expected_verses": verses,
        "version": source.version,
        "licence": source.licence.identifier,
        "licence_url": source.licence.url,
        "share_alike": source.licence.share_alike,
        "attribution": source.licence.attribution,
        "retrieved_at": date.today().isoformat(),
    }


def _merge_manifest(entries: dict[str, dict]) -> dict:
    """Fold new entries into the existing manifest, keeping untouched ones."""
    path = scripture_data_dir() / "manifest.json"
    document: dict = {"translations": {}}
    if path.is_file():
        document = json.loads(path.read_text(encoding="utf-8"))
    document["translations"].update(entries)
    document["generated_at"] = date.today().isoformat()
    document["note"] = (
        "Acquired by apps/api/scripts/acquire_sources.py. payload_sha256 is the "
        "digest of the DECOMPRESSED payload; the loader verifies it before "
        "parsing. expected_verses is measured by the real parser, not assumed."
    )
    return document


def acquire(codes: list[str]) -> int:
    """Download, cache and re-measure each translation. Returns an exit code."""
    entries: dict[str, dict] = {}
    for code in codes:
        source = require_source(code)
        print(f"[acquire] {code}: fetching {source.download_url}", flush=True)
        payload = _download(source)
        verses = len(parse_rows(source, payload.decode("utf-8-sig")))
        path = _write_cache(source, payload)
        entries[code] = _manifest_entry(source, payload, verses)
        note = "" if verses == source.expected_verses else "  <-- CATALOGUE DISAGREES"
        print(
            f"[acquire] {code}: {len(payload)} bytes -> {path.name}, "
            f"{verses} verses (catalogue says {source.expected_verses}){note}",
            flush=True,
        )
    document = _merge_manifest(entries)
    (scripture_data_dir() / "manifest.json").write_text(
        json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    disagreements = [
        code
        for code in codes
        if entries[code]["expected_verses"] != CATALOGUE[code].expected_verses
    ]
    if disagreements:
        print(
            f"[acquire] FAILED: {', '.join(disagreements)} no longer match the "
            "catalogue's verse counts. Investigate before loading.",
            file=sys.stderr,
        )
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Acquire public-domain scripture.")
    parser.add_argument("codes", nargs="*", help=f"one of: {', '.join(CATALOGUE)}")
    parser.add_argument("--all", action="store_true", help="every catalogue entry")
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)
    codes = list(CATALOGUE) if args.all else args.codes
    if not codes:
        print("Nothing to do: pass a translation code or --all.", file=sys.stderr)
        return 2
    return acquire(codes)


if __name__ == "__main__":
    raise SystemExit(main())
