"""Where the licence-verified enrichment datasets live, and what they may claim.

Purpose
    ``AI-05`` requires every badge payload to name its source and licence, and
    ``Q-007`` requires share-alike data to stay separable from everything else.
    Both obligations are only enforceable if the licence travels with the rows,
    so every ingest script registers its dataset here and writes the record into
    ``data_sources`` before it writes a single enrichment row.

Key responsibilities
    - Find ``data/raw/`` inside the container or in a host checkout.
    - Carry the licence text, attribution string and retrieval date that
      ``data/raw/<dir>/PROVENANCE.md`` verified, as data rather than prose.
    - Verify a payload byte-for-byte against the digest that provenance file
      records, so a swapped file can never reach a parser.

Dependencies
    Standard library only. No loader may reach the network at ingest time.

Usage
    path = dataset_file(MURAI, "LiteraryStructureoftheBible_PericopeList_NT.xlsx")
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from pathlib import Path

#: Overrides the search below. Set it when the data lives somewhere unusual.
RAW_DATA_DIR_ENV = "ATLAS_RAW_DATA_DIR"

#: Where docker-compose mounts the repository's data/ directory, read-only.
CONTAINER_RAW_DIR = Path("/data/raw")


class RawDatasetError(RuntimeError):
    """An acquired dataset is missing, unreadable, or fails its digest."""


@dataclass(frozen=True, slots=True)
class SourceLicence:
    """The licence facts a reader is entitled to see, verified at acquisition."""

    identifier: str
    url: str
    share_alike: bool
    attribution: str


@dataclass(frozen=True, slots=True)
class RawDataset:
    """One acquired directory under ``data/raw/``.

    ``key`` is the ``data_sources.key`` the enrichment rows point at, so the
    licence a badge displays and the licence a loader recorded are the same
    string in the same row.
    """

    key: str
    name: str
    url: str
    directory: str
    licence: SourceLicence
    version: str
    #: SHA-256 by file name, transcribed from the directory's PROVENANCE.md.
    digests: dict[str, str]


#: Wikidata's structured data is CC0, so there is no attribution obligation.
#: The string is still filled in because the History badge should credit where
#: a reign date came from even when no licence forces it to.
WIKIDATA_RULERS = RawDataset(
    key="wikidata_rulers",
    name="Wikidata ruler reigns",
    url="https://query.wikidata.org/sparql",
    directory="wikidata-rulers",
    licence=SourceLicence(
        identifier="CC0-1.0",
        url="https://creativecommons.org/publicdomain/zero/1.0/",
        share_alike=False,
        attribution="Reign dates from Wikidata, CC0 1.0 — wikidata.org",
    ),
    version="2026-08-29",
    digests={
        "nt-era-rulers.json": (
            "c375a72ba1af8c78a940aead8fbfacfa12ab72a1658790711e50a53dc66cf08f"
        ),
        "nt-era-officials.json": (
            "21efe71c97c050000c34ee057cbcc19596a744fd0f28b2e4072a3dedd23f03ad"
        ),
    },
)

#: CC BY-SA 4.0, and the only open source of per-passage biblical dating.
#: ``share_alike`` is TRUE, which is what keeps ``Q-007``'s separability rule
#: enforceable with a WHERE clause rather than a code review.
THEOGRAPHIC_EVENTS = RawDataset(
    key="theographic_events",
    name="Theographic Bible Metadata — Events",
    url="https://github.com/robertrouse/theographic-bible-metadata",
    directory="theographic-bible-metadata",
    licence=SourceLicence(
        identifier="CC-BY-SA-4.0",
        url="https://creativecommons.org/licenses/by-sa/4.0/",
        share_alike=True,
        attribution=(
            "Event dating from Theographic Bible Metadata, CC BY-SA 4.0 — "
            "github.com/robertrouse/theographic-bible-metadata"
        ),
    ),
    version="2026-08-28",
    digests={
        "Events.csv": ("3325439a8d56d9a9f40895d26b119bfd82e5c21ceb07b93fd2e69eec30850a98"),
    },
)

#: CC BY 4.0. The attribution string is the one the site itself asks for, and
#: ``Q-015`` requires the UI to render it beside every structure it draws.
MURAI_STRUCTURE = RawDataset(
    key="murai_literary_structure",
    name="Literary Structure of the Bible (Hajime Murai)",
    url="http://bible.literarystructure.info/bible/bible_e.html",
    directory="murai-literary-structure",
    licence=SourceLicence(
        identifier="CC-BY-4.0",
        url="https://creativecommons.org/licenses/by/4.0/",
        share_alike=False,
        attribution=(
            "Literary structure analysis by Hajime Murai, CC BY 4.0 — "
            "bible.literarystructure.info"
        ),
    ),
    version="2022-02-24",
    digests={
        "LiteraryStructureoftheBible_PericopeList_OT.xlsx": (
            "0e7ef46da8d25fab61622e540f914fce07338b59db77795eeef8549809a9ff7b"
        ),
        "LiteraryStructureoftheBible_PericopeList_NT.xlsx": (
            "de8ff7bf656efe9bbb23e3d7903e46b01495970d6c166c94f66d692fa3d6276e"
        ),
        "LiteraryStructureoftheBible_PericopeStructure_OT.xlsx": (
            "5313bc88194f7e5610f320e01a8753bfad0cd438f34a286cc59fc302cc421a62"
        ),
        "LiteraryStructureoftheBible_PericopeStructure_NT.xlsx": (
            "ea0659a0d316684786d2470583a80965f0f9483d8b0d25ff5843e3bf84de446b"
        ),
    },
)


def raw_data_dir() -> Path:
    """Locate ``data/raw/``, in the container or in a host checkout."""
    override = os.environ.get(RAW_DATA_DIR_ENV)
    if override:
        return Path(override)
    if CONTAINER_RAW_DIR.is_dir():
        return CONTAINER_RAW_DIR
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "data" / "raw"
        if candidate.is_dir():
            return candidate
    raise RawDatasetError(
        "data/raw/ not found. Mount the repository's data/ directory at /data, "
        f"or set {RAW_DATA_DIR_ENV}."
    )


def dataset_file(dataset: RawDataset, name: str) -> Path:
    """The path to one file inside an acquired dataset, checked for existence."""
    path = raw_data_dir() / dataset.directory / name
    if not path.is_file():
        raise RawDatasetError(
            f"{path} is missing. See data/raw/{dataset.directory}/PROVENANCE.md "
            "for the acquisition command."
        )
    return path


def verify_digest(dataset: RawDataset, name: str) -> Path:
    """Return the path only if its bytes match the recorded SHA-256.

    A digest mismatch is fatal. Corrupted enrichment data does not announce
    itself: it produces plausible-looking badges that quietly misattribute a
    claim, which is precisely the failure ``AI-05`` exists to prevent.
    """
    path = dataset_file(dataset, name)
    expected = dataset.digests.get(name)
    if expected is None:
        raise RawDatasetError(f"{name} has no recorded digest in {dataset.key}.")
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != expected:
        raise RawDatasetError(
            f"{path} does not match its provenance record. Expected SHA-256 "
            f"{expected}, got {actual}. Refusing to load it."
        )
    return path
