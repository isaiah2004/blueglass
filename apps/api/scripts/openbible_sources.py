"""Where the acquired OpenBible datasets live, and what they are licensed as.

Purpose
    Two badges -- Cross-Ref and Route -- are served from two OpenBible.info
    downloads that already sit in ``data/raw/``. This module is the single place
    that knows where those bytes are, what they must hash to, and the exact
    licence and attribution string the UI has to render beside anything derived
    from them. AI-05 requires every badge payload to name its source, so that
    string is written to ``data_sources`` and read back from the database rather
    than being typed into a component.

Key responsibilities
    - Locate ``data/raw/`` inside the container or in a host checkout.
    - Verify a payload against its recorded SHA-256 before a parser sees it.
    - Carry the provenance record for each dataset, transcribed from the
      ``PROVENANCE.md`` written next to the data at acquisition time.

Dependencies
    Standard library only, so an ingest can never silently reach the network.

Usage
    payload = read_bytes(CROSS_REFERENCES.files["cross-references.zip"])
    await upsert_source(connection, CROSS_REFERENCES)
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import asyncpg

#: Overrides the search below. Set it when the data lives somewhere unusual.
RAW_DIR_ENV = "ATLAS_RAW_DATA_DIR"

#: Where docker-compose mounts the repository's data/ directory, read-only.
CONTAINER_RAW_DIR = Path("/data/raw")


class RawDataError(RuntimeError):
    """An acquired file is missing, truncated, or does not match its digest."""


@dataclass(frozen=True, slots=True)
class RawFile:
    """One acquired file: where it sits and what it must hash to."""

    directory: str
    name: str
    size_bytes: int
    sha256: str

    @property
    def path(self) -> Path:
        """The file's location, resolved for this machine."""
        return raw_data_dir() / self.directory / self.name


@dataclass(frozen=True, slots=True)
class SourceRecord:
    """Everything ``data_sources`` needs for one dataset.

    ``attribution`` is the literal string a reader must see. It is quoted from
    the dataset's own PROVENANCE.md, not composed here, because a badge that
    cannot name its source must not render (AI-05).
    """

    key: str
    name: str
    url: str
    licence: str
    share_alike: bool
    attribution: str
    version: str
    retrieved_at: date
    files: tuple[RawFile, ...]


CROSS_REFERENCE_ARCHIVE = RawFile(
    directory="openbible-cross-references",
    name="cross-references.zip",
    size_bytes=1_981_803,
    sha256="2006d1af4af558dc39b4dca77023bc1dc77dabf67d8ad9c98e0af1f86fe05644",
)

ANCIENT_PLACES = RawFile(
    directory="openbible-geocoding",
    name="ancient.jsonl",
    size_bytes=11_550_193,
    sha256="b8187aa4737e8517ccc090f765d2be11da4c548cd2a59d3cdcb62e952cb8c0f2",
)

MODERN_PLACES = RawFile(
    directory="openbible-geocoding",
    name="modern.jsonl",
    size_bytes=3_224_520,
    sha256="da731f6e110bac4ea66a9f037a0a31cfb11c4f1efc1206aa9e109092b2c60087",
)

#: The licence travels inside the data file's own header row, which is the
#: strongest evidence there is -- it cannot be separated from the bytes.
CROSS_REFERENCES = SourceRecord(
    key="openbible_xref",
    name="OpenBible.info Cross References",
    url="https://a.openbible.info/data/cross-references.zip",
    licence="CC-BY-4.0",
    share_alike=False,
    attribution="Cross-references © OpenBible.info, CC BY 4.0",
    version="2026-08-24",
    retrieved_at=date(2026, 8, 28),
    files=(CROSS_REFERENCE_ARCHIVE,),
)

GEOCODING = SourceRecord(
    key="openbible_geocoding",
    name="OpenBible.info Bible Geocoding Data",
    url="https://github.com/openbibleinfo/Bible-Geocoding-Data",
    licence="CC-BY-4.0",
    share_alike=False,
    attribution="Place data © OpenBible.info, CC BY 4.0",
    version="2021-11-01",
    retrieved_at=date(2026, 8, 28),
    files=(ANCIENT_PLACES, MODERN_PLACES),
)

_UPSERT_SOURCE = """
    INSERT INTO data_sources
        (key, name, url, license, share_alike, attribution, version,
         retrieved_at, loaded_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
    ON CONFLICT (key) DO UPDATE SET
        name = excluded.name, url = excluded.url, license = excluded.license,
        share_alike = excluded.share_alike, attribution = excluded.attribution,
        version = excluded.version, retrieved_at = excluded.retrieved_at,
        loaded_at = excluded.loaded_at
    RETURNING id
"""


def raw_data_dir() -> Path:
    """Locate ``data/raw/``, in the container or in a host checkout."""
    override = os.environ.get(RAW_DIR_ENV)
    if override:
        return Path(override)
    if CONTAINER_RAW_DIR.is_dir():
        return CONTAINER_RAW_DIR
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "data" / "raw"
        if candidate.is_dir():
            return candidate
    raise RawDataError(
        "data/raw/ not found. Mount the repository's data/ directory at /data, "
        f"or set {RAW_DIR_ENV}."
    )


def read_bytes(acquired: RawFile) -> bytes:
    """Read one acquired file, refusing anything that is not byte-identical.

    A silently swapped gazetteer would still parse and would still produce
    plausible-looking pins in the wrong hemisphere, so the digest is checked
    before the parser ever runs rather than after the load looks odd.
    """
    path = acquired.path
    if not path.is_file():
        raise RawDataError(
            f"{path} is missing. See data/raw/{acquired.directory}/PROVENANCE.md "
            "for the acquisition command."
        )
    payload = path.read_bytes()
    if len(payload) != acquired.size_bytes:
        raise RawDataError(
            f"{path} is {len(payload)} bytes; PROVENANCE.md records "
            f"{acquired.size_bytes}. Refusing to load it."
        )
    digest = hashlib.sha256(payload).hexdigest()
    if digest != acquired.sha256:
        raise RawDataError(
            f"{path} does not match its recorded SHA-256. Expected "
            f"{acquired.sha256}, got {digest}. Refusing to load it."
        )
    return payload


async def upsert_source(connection: asyncpg.Connection, record: SourceRecord) -> int:
    """Write the provenance row and return its id.

    Called first in every ingest transaction: a content row can only point at a
    source that already exists, which is what makes the share-alike
    separability rule enforceable with a WHERE clause instead of a code review.
    """
    source_id = await connection.fetchval(
        _UPSERT_SOURCE,
        record.key,
        record.name,
        record.url,
        record.licence,
        record.share_alike,
        record.attribution,
        record.version,
        record.retrieved_at,
    )
    if source_id is None:
        raise RawDataError(f"data_sources upsert returned no id for {record.key}.")
    return int(source_id)
