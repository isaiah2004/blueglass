"""Where the original-language files are, and what may be said about them.

Purpose
    One place that knows every fact the database must record about a lexicon
    source: its licence identifier, the exact attribution string the UI has to
    render, when it was retrieved, and how many rows it must produce. AI-05
    ("every claim carries a source anchor or is not shown") is enforced by the
    schema, but it is only true if these strings are right, so they are quoted
    from the PROVENANCE.md beside each payload rather than recalled.

Key responsibilities
    - Describe each source once, as data.
    - Find data/raw/ from inside the container or from a host checkout.

Dependencies
    Standard library only. No network: every byte is already on disk.

Usage
    path = payload_path(TAGNT_GREEK, "TAGNT_Act-Rev.txt")
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path

#: Overrides the search below when the data lives somewhere unusual.
DATA_DIR_ENV = "ATLAS_RAW_DATA_DIR"

#: Where docker-compose mounts the repository's data/ directory, read-only.
CONTAINER_RAW_DIR = Path("/data/raw")


class LexiconDataError(RuntimeError):
    """An acquired lexicon file is missing or does not match expectations."""


@dataclass(frozen=True, slots=True)
class LexiconSource:
    """One row-set's provenance, exactly as it will be written to data_sources."""

    key: str
    name: str
    url: str
    licence: str
    share_alike: bool
    attribution: str
    version: str
    retrieved_at: date
    directory: str


_RETRIEVED = date(2026, 8, 28)

#: STEPBible's own README asks that others be referred to github.com/STEPBible
#: rather than to a mirror. That is a request on top of a CC BY 4.0 grant, not a
#: licence condition (docs/architecture/dataset-validation.md section 3.5), and
#: Q-007 keeps the database server-side anyway, so nothing here is redistributed.
_STEP_ATTRIBUTION = "STEP Bible — www.STEPBible.org (CC BY 4.0)"
_STEP_URL = "https://github.com/STEPBible/STEPBible-Data"

TAGNT_GREEK = LexiconSource(
    key="stepbible_tagnt",
    name="STEPBible TAGNT — Translators Amalgamated Greek New Testament",
    url=_STEP_URL,
    licence="CC-BY-4.0",
    share_alike=False,
    attribution=_STEP_ATTRIBUTION,
    version="TAGNT Mat-Jhn + Act-Rev, master branch",
    retrieved_at=_RETRIEVED,
    directory="stepbible",
)

TBESG_LEXICON = LexiconSource(
    key="stepbible_tbesg",
    name="STEPBible TBESG — Translators Brief lexicon of Extended Strongs for Greek",
    url=_STEP_URL,
    licence="CC-BY-4.0",
    share_alike=False,
    attribution=_STEP_ATTRIBUTION,
    version="TBESG, master branch; definitions after Abbott-Smith (1922, PD)",
    retrieved_at=_RETRIEVED,
    directory="stepbible",
)

DODSON_LEXICON = LexiconSource(
    key="dodson_greek_lexicon",
    name="Dodson Greek Lexicon",
    url="https://github.com/biblicalhumanities/Dodson-Greek-Lexicon",
    licence="CC0-1.0",
    share_alike=False,
    # CC0 imposes no attribution duty at all. We print one because taking the
    # work silently would be worse manners than the licence requires.
    attribution="Dodson Greek Lexicon — public domain (CC0 1.0)",
    version="master branch, last upstream push 2018-01-11",
    retrieved_at=_RETRIEVED,
    directory="dodson-greek-lexicon",
)

HEBREW_LEXICON = LexiconSource(
    key="oshb_hebrew_lexicon",
    name="Open Scriptures Hebrew Lexicon — Strong's Hebrew Dictionary",
    url="https://github.com/openscriptures/HebrewLexicon",
    licence="CC-BY-4.0",
    share_alike=False,
    attribution="Open Scriptures Hebrew Bible Project, CC BY 4.0",
    version="HebrewStrong.xml, master branch",
    retrieved_at=_RETRIEVED,
    directory="openscriptures-hebrew-lexicon",
)

#: The English alignment is OURS. It is not in any acquired file, so it gets its
#: own provenance row and names the data it was derived from, rather than
#: borrowing TAGNT's attribution and implying STEPBible published it.
ALIGNMENT_SOURCE = LexiconSource(
    key="atlas_gloss_alignment",
    name="Atlas Bible English-to-Greek word alignment",
    url=_STEP_URL,
    licence="CC-BY-4.0",
    share_alike=False,
    attribution=(
        "Word alignment computed by Atlas Bible from STEP Bible TAGNT glosses "
        "(STEP Bible — www.STEPBible.org, CC BY 4.0)"
    ),
    version="gloss-uniqueness alignment v1",
    retrieved_at=_RETRIEVED,
    directory="stepbible",
)

ALL_SOURCES: tuple[LexiconSource, ...] = (
    TAGNT_GREEK,
    TBESG_LEXICON,
    DODSON_LEXICON,
    HEBREW_LEXICON,
    ALIGNMENT_SOURCE,
)

#: TAGNT ships as two files only because GitHub rejects one that large.
TAGNT_FILES: tuple[str, ...] = ("TAGNT_Mat-Jhn.txt", "TAGNT_Act-Rev.txt")
TBESG_FILE = "TBESG.txt"
DODSON_FILE = "dodson.csv"
HEBREW_STRONG_FILE = "HebrewStrong.xml"


def raw_data_dir() -> Path:
    """Locate data/raw/, in the container or in a host checkout."""
    override = os.environ.get(DATA_DIR_ENV)
    if override:
        return Path(override)
    if CONTAINER_RAW_DIR.is_dir():
        return CONTAINER_RAW_DIR
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "data" / "raw"
        if candidate.is_dir():
            return candidate
    raise LexiconDataError(
        "data/raw/ not found. Mount the repository's data/ directory at /data, "
        f"or set {DATA_DIR_ENV}."
    )


def payload_path(source: LexiconSource, filename: str) -> Path:
    """One file belonging to a source, checked to exist before it is opened."""
    path = raw_data_dir() / source.directory / filename
    if not path.is_file():
        raise LexiconDataError(
            f"{path} is missing. See data/raw/{source.directory}/PROVENANCE.md "
            "for how it was acquired."
        )
    return path
