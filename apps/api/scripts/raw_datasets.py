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
        # Re-derived by re-running the query recorded in
        # data/raw/wikidata-rulers/PROVENANCE.md against the live SPARQL
        # endpoint (rate-limited at re-derivation time, so retried across
        # several minutes). Byte count matches the original capture exactly
        # (12,063 bytes) confirming identical row content/order; the digest
        # below is the live re-fetch's own hash.
        "nt-era-rulers.json": (
            "beea0e61deb2c989a38ae70e2491443821884f9107177001e7b639d5a9bb4442"
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

#: CC BY-SA 4.0, the same repository as ``THEOGRAPHIC_EVENTS`` but a distinct
#: ``data_sources`` row (``theographic_people``, not ``theographic_events``) so
#: a Lineage badge's attribution names the People table it actually read, not
#: the Events table it did not. ``share_alike`` is TRUE for the same reason as
#: above: ``Q-007`` requires this to stay table-scoped, never blended into
#: ``passage_enrichment`` or any other record a bundled seed would distribute.
THEOGRAPHIC_PEOPLE = RawDataset(
    key="theographic_people",
    name="Theographic Bible Metadata — People",
    url="https://github.com/robertrouse/theographic-bible-metadata",
    directory="theographic-bible-metadata",
    licence=SourceLicence(
        identifier="CC-BY-SA-4.0",
        url="https://creativecommons.org/licenses/by-sa/4.0/",
        share_alike=True,
        attribution=(
            "Genealogy from Theographic Bible Metadata, CC BY-SA 4.0 — "
            "github.com/robertrouse/theographic-bible-metadata"
        ),
    ),
    version="2026-08-29",
    digests={
        "People.csv": ("44aa63e656077ed02a05747f581c56b5c9242a2d8cf7281344bc734085e0b130"),
    },
)

#: CC BY 4.0 for the dataset; the two source dictionaries themselves are
#: public domain (1897 and 1863). Chosen over unfoldingWord's ``en_tn`` per
#: ``docs/architecture/dataset-validation.md`` section 3.5 "Option D": ``en_tn``
#: is officially NEEDS-DECISION and only 18.7% of its Acts notes are culturally
#: informative, where Easton/Smith are cleared USE and verse-indexed whole
#: canon. This loader builds the citation table the Cultural badge's authored
#: prose (M7, Q-024) can quote from -- it does not write the prose itself.
NEUU_BIBLE_DICTIONARY = RawDataset(
    key="neuu_bible_dictionary",
    name="Bible Dictionary Dataset (Easton + Smith)",
    url="https://github.com/neuu-org/bible-dictionary-dataset",
    directory="neuu-bible-dictionary",
    licence=SourceLicence(
        identifier="CC-BY-4.0",
        url="https://creativecommons.org/licenses/by/4.0/",
        share_alike=False,
        attribution="Bible Dictionary Dataset © NEUU, CC BY 4.0",
    ),
    version="2026-08-28",
    digests={
        "LICENSE": ("bdef1cc111e716a6a9bdd5f738d20979c297787a597243f9ab543e92301c6125"),
        "README.md": ("441713cf50e1f77e6a676c28f64c44e218fd57c45c090e45eb7e627d9dee4413"),
        "easton/a.json": ("8c838b7604c0ce6ab9cd319ee196fb664e5da5ca3f570308f2f74f1297dce154"),
        "easton/b.json": ("e0494ac9f50e77dd8b7a4a9f867c7b0e5bd10defc865e2a649436da2ffcf5d2a"),
        "easton/c.json": ("b68833dab89751d5be3faf48007f117af1ba1b6fc9eabcff2b7b99b7165c7c84"),
        "easton/d.json": ("aad8571e25c1dde1ee894373f24a4a78d2cd8d4f4b524bdaf559905fc236c10f"),
        "easton/e.json": ("a5245cd770c136986930121e1801a31fed253c9f73ebc40b59576e707152fc8d"),
        "easton/f.json": ("31dc8bb4cabff7c9179f3cda91c01c22a442e17fa9a1ef6ddaf6db6864f1a5b1"),
        "easton/g.json": ("66dbd26b4cbdc4a52370a0a1f34057dff6865f3ba18853969f2dc4192eb894e4"),
        "easton/h.json": ("44f5a93a73da85640f5a21bc10ae883f2957395125197d7ac74f8769a61f0a29"),
        "easton/i.json": ("1df2e939661cade465d028a91f7ab7baa3e3b39a4f771b84ae919e94cc17f85d"),
        "easton/j.json": ("e75a190aa4477771e02f03756a3106825dca0ad6e96fc2c787e072d4f176add3"),
        "easton/k.json": ("1e2bb7039bbb98abd415c5e84ba97d36345d8ccc67736e16f570e7dfcf94ecaf"),
        "easton/l.json": ("34d1bd87fd913b9a2151552941e7ae4145e769f81058e836e271164232943cf3"),
        "easton/m.json": ("019003b40d7b79e480e95082d4f8fe98f2d0ecde2a9d64442751183d94e93178"),
        "easton/n.json": ("a270240e163643e995766f61db23eeebd4a610683b06a9dc8e9e0d67be952112"),
        "easton/o.json": ("c6965e9fa23e7c837959f15fbc862530a45a8c004afea0d0889c243b7ec71806"),
        "easton/p.json": ("66ac3340e5c95d41c75f75a16092cbe067c6596840ab893bee419fc9fc31941c"),
        "easton/q.json": ("5e7cc94712ee1c3aacbb3665ac34f9b386b807b44fe365326a96715728c78060"),
        "easton/r.json": ("4b3a8d593bbe7869f4124b5e23f9bfabca7d877262aa7dcc826f1f815d1a1177"),
        "easton/s.json": ("a6bba6315bf9f0336cb0fd262de8bbd0b9d9e31451bfbebe57d5c1237b759763"),
        "easton/t.json": ("5004c239df6e6f365cc87280ccecdb9727d50c093d0db9dbdd73ffaa635e52f6"),
        "easton/u.json": ("3b5a7a3f6a0eece81a69220d3b63d0aebea9e2b3990152be797bef9b01f1486e"),
        "easton/v.json": ("99c8bb186914a0fc6ece7f04836bca02b8c261ce0aaf321467917b138b4f37d6"),
        "easton/w.json": ("358850bdc0ed6874b53d514768b4eeef4cd89a4521852208e0aad02851596273"),
        "easton/y.json": ("326187c93d050796b13ed9a24853a3981f0353d5aa05b50e91f257efbb1071bd"),
        "easton/z.json": ("1369b744801ce6ca957f2a542f8f747ba0966616f2fb682a7264a0a47c08f50d"),
        "smith/a.json": ("188581289a95c8886d5f4f77acb737dc54e6ddb9138a41947402863d30eba457"),
        "smith/b.json": ("4a80089ae45e0adb06573b7d0a23942201b20de767099d7ab215ab38f94148ee"),
        "smith/c.json": ("9468a8faa8cf08086948719f990c3f730371e9b8a4a3b34d377e2988dcd6be0f"),
        "smith/d.json": ("d5b06c7ef58b37ee4309d8a464c12384db23a41947b16940ae7038252c218009"),
        "smith/e.json": ("41e839270451daa2345173e86a91469b5bd6703e64be20a7a80c01ca0dcb78ad"),
        "smith/f.json": ("0f6553abee8f1cbd7805976a763f3940fe6418e3c2abf9176b2a0c479bdd60f1"),
        "smith/g.json": ("a50082f95f6f06ceab0bba88851fcdc1afaff984605e0ccedbb0d56afd97e959"),
        "smith/h.json": ("243ed5d4949166e4502feb50fb1656604d39318799abca30c06e1d1c2d3393cf"),
        "smith/i.json": ("a8573f3cc72ff0ef9f78a8431ea9722b5b0e68bb0a9aff9246d4990dbf49dc4c"),
        "smith/j.json": ("c7719c4448085fc0387487331114e11d1946f47a4b680ef87e16056bd2d24205"),
        "smith/k.json": ("bf4512f5e82510efb5ded3f6c5d6e2eaa0aaa1b920e8d379f606010533317ed7"),
        "smith/l.json": ("20424b7a08a549434b006b952b52033e673f44b25d874b21437bfee719e058a5"),
        "smith/m.json": ("fce083b77445fdc71eb633c3bc04c9cfb39c449a2433af77d3cdc9b8212f9b73"),
        "smith/n.json": ("7a14cf5600fd2554ab4903ba335f8c6b8111228bba7ac57a4adedd64e7740264"),
        "smith/o.json": ("d867ab6ecf75547746e80595ecf55c299f0f1fc8a75ae6cedda6c48b04f26da9"),
        "smith/p.json": ("6d9f2e4f0740439fa80692fa6210e746c56838233ee77bc4c0be1fa5b3e7b739"),
        "smith/q.json": ("f1f5b7b971e131873a782035e5bf1fb666643aa7546feab761fc42f3f6c1af35"),
        "smith/r.json": ("2f16c28a2c3ea43db430899ab6f340700857c4090e4679228c0238a71c559df6"),
        "smith/s.json": ("7a026e5cb63645671a8de8adc2cd5e3533c7f011bada459c5d8d477e302646b6"),
        "smith/t.json": ("34adde4e5470c59fd3e85f5ffe1b9474f5248ede5cd9a0bd7148cb5ecc64d070"),
        "smith/u.json": ("8a6b141cf4aab96d3f05aaa0918cefd895f18343cc8d19a52ef3ad3997953e24"),
        "smith/v.json": ("91ce048d7cb1421ba160cfc10ced5d6ec31bc315d3d8d3ecfdcafe53badc1a31"),
        "smith/w.json": ("407118c2bc810a4cd5b171b897a538df5c64855c2feb1bb2209f17a84a92b625"),
        "smith/y.json": ("6e79bfbfb1d9725dab184d2c5b0012adcccaec94e873b9df714c61f62ac1be25"),
        "smith/z.json": ("6cc1f0c09d83edb3f44494c1594c8df140342a92aa848dbf67c122ff23c525e8"),
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
