"""Where the acquired scripture files live, and how their integrity is checked.

Purpose
    data-inventory.md section 4 records the prototype's worst data risk: nothing
    was bundled, both loaders fetched from raw.githubusercontent.com at load
    time, and "if that repo moves or the DB volume is lost, there is no local
    copy to rebuild from". That is fixed here. Every translation is acquired
    once into data/scripture/sources/ as a gzipped payload with its SHA-256
    recorded, and the loader reads only from there. A fresh clone can seed a
    working database with the network unplugged.

Key responsibilities
    - Find data/scripture/ from inside the container or from a host checkout.
    - Read the manifest.
    - Decompress one payload and verify it byte-for-byte before it is parsed.

Dependencies
    Standard library only, so the loader cannot silently reach the network.

Usage
    payload = read_payload(CATALOGUE["BSB"])
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from scripts.translation_catalogue import TranslationSource

#: Overrides the search below. Set it when the data lives somewhere unusual.
DATA_DIR_ENV = "ATLAS_SCRIPTURE_DATA_DIR"

#: Where docker-compose mounts the repository's data/ directory, read-only.
CONTAINER_DATA_DIR = Path("/data/scripture")

MANIFEST_NAME = "manifest.json"
SOURCES_DIRNAME = "sources"


class ScriptureDataError(RuntimeError):
    """The acquired files are missing, unreadable, or do not match the manifest."""


@dataclass(frozen=True, slots=True)
class PayloadRecord:
    """One manifest entry: what the file is and what it must hash to."""

    payload_name: str
    payload_bytes: int
    payload_sha256: str
    expected_verses: int

    @classmethod
    def from_json(cls, entry: dict[str, Any]) -> PayloadRecord:
        """Build from a manifest entry, failing on a missing field."""
        try:
            return cls(
                payload_name=str(entry["payload_name"]),
                payload_bytes=int(entry["payload_bytes"]),
                payload_sha256=str(entry["payload_sha256"]),
                expected_verses=int(entry["expected_verses"]),
            )
        except KeyError as missing:
            raise ScriptureDataError(f"Manifest entry is missing {missing}.") from None


def scripture_data_dir() -> Path:
    """Locate data/scripture/, in the container or in a host checkout."""
    override = os.environ.get(DATA_DIR_ENV)
    if override:
        return Path(override)
    if CONTAINER_DATA_DIR.is_dir():
        return CONTAINER_DATA_DIR
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "data" / "scripture"
        if candidate.is_dir():
            return candidate
    raise ScriptureDataError(
        "data/scripture/ not found. Mount the repository's data/ directory at "
        f"/data, or set {DATA_DIR_ENV}."
    )


def manifest_path() -> Path:
    """The manifest file, wherever the data directory turned out to be."""
    return scripture_data_dir() / MANIFEST_NAME


def load_manifest() -> dict[str, PayloadRecord]:
    """Read the manifest, keyed by translation code."""
    path = manifest_path()
    if not path.is_file():
        raise ScriptureDataError(
            f"{path} is missing. Run: python -m scripts.acquire_sources --all"
        )
    document = json.loads(path.read_text(encoding="utf-8"))
    return {
        code: PayloadRecord.from_json(entry)
        for code, entry in document["translations"].items()
    }


def cache_file_for(source: TranslationSource) -> Path:
    """The gzipped payload for one translation."""
    return scripture_data_dir() / SOURCES_DIRNAME / f"{source.payload_name}.gz"


def sha256_of(payload: bytes) -> str:
    """Hex digest of the decompressed payload."""
    return hashlib.sha256(payload).hexdigest()


def read_payload(source: TranslationSource) -> str:
    """Decompress and verify one translation's payload, then decode it.

    A hash mismatch is fatal. The whole point of pinning the digest is that a
    corrupted or quietly swapped file must never reach the parser, where it
    would most likely still produce plausible-looking verses.
    """
    record = load_manifest().get(source.code)
    if record is None:
        raise ScriptureDataError(f"{source.code} is not in {manifest_path()}.")
    path = cache_file_for(source)
    if not path.is_file():
        raise ScriptureDataError(
            f"{path} is missing. Run: python -m scripts.acquire_sources {source.code}"
        )
    payload = gzip.decompress(path.read_bytes())
    digest = sha256_of(payload)
    if digest != record.payload_sha256:
        raise ScriptureDataError(
            f"{path} does not match the manifest. Expected SHA-256 "
            f"{record.payload_sha256}, got {digest}. Refusing to load it."
        )
    if len(payload) != record.payload_bytes:
        raise ScriptureDataError(
            f"{path} is {len(payload)} bytes, manifest says {record.payload_bytes}."
        )
    return payload.decode("utf-8-sig")
