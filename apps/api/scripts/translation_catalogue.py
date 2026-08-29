"""Which translations may be loaded, where they come from, and what to expect.

Decision S-01 ships multiple open translations with a switcher. Four are
catalogued here, all public domain, all verified against the publisher's own
licence statement -- see translation_licences.py and data/scripture/PROVENANCE.md.

ON THE VERSE COUNTS
    Each entry names the exact number of verses a complete load must produce.
    The loader asserts it twice: once on the parsed rows, once on the committed
    table. A truncated download therefore cannot leave a half-Bible in the
    database looking healthy. The prototype's load_more_translations.py had no
    assertion at all, which is why nobody could say whether ASV and WEB had ever
    loaded (data-inventory.md section 8, question 2).

    The numbers legitimately DIFFER and unifying them would be a mistake:

      KJV  31102  the Textus Receptus versification, every verse with text.
      ASV  31086  sixteen fewer. The ASV follows the critical text, so Matt
                  17:21, 18:11, 23:14; Mark 7:16, 9:44, 9:46, 11:26, 15:28;
                  Luke 17:36, 23:17; John 5:4; Acts 8:37, 15:34, 24:7, 28:29
                  and Rom 16:24 are present as empty verses and are not loaded.
      BSB  31086  exactly the same sixteen, same reason.
      WEB  31098  31103 printed verse numbers less five empty ones (Luke 17:36,
                  Acts 8:37, 15:34, 24:7 and Rom 16:25). It prints eleven of the
                  sixteen and differs in versification: the Romans doxology sits
                  at 14:24-26 rather than 16:25-27, so it carries three verse
                  numbers the KJV does not and lacks two the KJV has.

    All four counts were MEASURED from the acquired files on 2026-08-29, not
    assumed. data/scripture/manifest.json carries the same numbers next to the
    SHA-256 of the bytes they were measured from.

WHY NOT scrollmapper/bible_databases, which the prototype used
    Its KJVPCE dataset is corrupt. Joshua 15:1, Job 7:1, Hosea 8:1 and Romans
    8:1 are empty strings -- in the JSON, the CSV, and every other format the
    repository publishes. Romans 8:1 is one of the best-known verses in the
    Bible. A reader would have found this before we did. eBible.org's editions
    were checked verse-for-verse against the same references and are complete.
"""

from __future__ import annotations

from dataclasses import dataclass

from scripts.translation_licences import (
    ASV_LICENCE,
    BSB_LICENCE,
    KJV_LICENCE,
    WEB_LICENCE,
    SourceLicence,
)
from scripts.verse_rows import VERBATIM, TextCleanup

#: eBible.org publishes a "verse per line" archive per translation: one zip
#: holding `CODE C:V text` lines plus an about page carrying the copyright.
EBIBLE_VPL = "ebible-vpl"

#: bereanbible.com publishes the official BSB as a single tab-separated file,
#: `Book C:V<TAB>text`, with three header lines.
BEREAN_TSV = "berean-tsv"


@dataclass(frozen=True, slots=True)
class TranslationSource:
    """One loadable translation: where it comes from and what it must produce."""

    code: str
    name: str
    language: str
    #: EBIBLE_VPL or BEREAN_TSV. Chooses the parser, nothing else.
    text_format: str
    #: The upstream artefact. Fetched by acquire_sources.py, never by the loader.
    download_url: str
    #: Member to extract when download_url is a zip; None for a plain file.
    archive_member: str | None
    #: File name under data/scripture/sources/, without the .gz suffix.
    payload_name: str
    #: Measured, not assumed. Asserted before commit and again after.
    expected_verses: int
    #: Publisher-specific typographic marks to remove. VERBATIM for anything
    #: whose licence or convention says leave it exactly as published.
    cleanup: TextCleanup
    #: data_sources.key. One row per translation, so each carries its own
    #: attribution rather than sharing a publisher-level one.
    source_key: str
    #: What the publisher calls this edition. Recorded as data_sources.version.
    version: str
    licence: SourceLicence


_EBIBLE = "https://ebible.org/Scriptures"

#: eBible marks the translators' supplied words -- italics in a printed Bible --
#: with [square brackets]. Stripping the two characters leaves every word
#: untouched and gives the reader prose instead of markup.
_EBIBLE_ITALICS = TextCleanup(strip_supplied_brackets=True)

#: The KJV additionally opens 2,970 verses with a pilcrow paragraph mark.
_EBIBLE_KJV = TextCleanup(strip_supplied_brackets=True, strip_paragraph_marks=True)


CATALOGUE: dict[str, TranslationSource] = {
    "BSB": TranslationSource(
        code="BSB",
        name="Berean Standard Bible",
        language="en",
        text_format=BEREAN_TSV,
        download_url="https://bereanbible.com/bsb.txt",
        archive_member=None,
        payload_name="bsb.txt",
        expected_verses=31086,
        cleanup=VERBATIM,
        source_key="scripture_bsb",
        version="2023 public-domain dedication",
        licence=BSB_LICENCE,
    ),
    "KJV": TranslationSource(
        code="KJV",
        name="King James (Authorized) Version",
        language="en",
        text_format=EBIBLE_VPL,
        download_url=f"{_EBIBLE}/eng-kjv2006_vpl.zip",
        archive_member="eng-kjv2006_vpl.txt",
        payload_name="eng-kjv2006_vpl.txt",
        expected_verses=31102,
        cleanup=_EBIBLE_KJV,
        source_key="scripture_kjv",
        version="standardized 1769 text, eBible edition 2026-08-19",
        licence=KJV_LICENCE,
    ),
    "WEB": TranslationSource(
        code="WEB",
        name="World English Bible",
        language="en",
        text_format=EBIBLE_VPL,
        download_url=f"{_EBIBLE}/engwebp_vpl.zip",
        archive_member="engwebp_vpl.txt",
        payload_name="engwebp_vpl.txt",
        expected_verses=31098,
        # The trademark permits any use of the text but not calling an ALTERED
        # text the World English Bible. There is nothing to strip here anyway,
        # and VERBATIM makes the loader incapable of altering it.
        cleanup=VERBATIM,
        source_key="scripture_web",
        version="2020 stable text edition",
        licence=WEB_LICENCE,
    ),
    "ASV": TranslationSource(
        code="ASV",
        name="American Standard Version (1901)",
        language="en",
        text_format=EBIBLE_VPL,
        download_url=f"{_EBIBLE}/eng-asv_vpl.zip",
        archive_member="eng-asv_vpl.txt",
        payload_name="eng-asv_vpl.txt",
        expected_verses=31086,
        cleanup=_EBIBLE_ITALICS,
        source_key="scripture_asv",
        version="1901 text, eBible edition",
        licence=ASV_LICENCE,
    ),
}
"""Insertion order is the order `--all` loads and the order a fresh seed
reports. BSB is first because it is the default the reader opens on."""


def require_source(code: str) -> TranslationSource:
    """Look up a catalogue entry, failing with the list of valid codes."""
    try:
        return CATALOGUE[code]
    except KeyError:
        raise SystemExit(
            f"Unknown translation {code!r}. Known: {', '.join(CATALOGUE)}."
        ) from None
