"""The licence facts for every translation this project may load.

WHY THIS FILE EXISTS SEPARATELY
    Decision S-01 ships "multiple open translations with a switcher", and the
    only thing standing between that and a copyright problem is that somebody
    checked each licence and wrote down what they read. This file is that
    record. Every string below was read from the publisher's own page or from
    the copyright notice shipped inside the download itself on 2026-08-29, not
    recalled -- see data/scripture/PROVENANCE.md for the verbatim quotes.

    ESV appears in the product mockups. It is licensed by Crossway, it is not
    here, and it must never be added.

WHY IT IS LOADED INTO POSTGRES AND NOT JUST READ BY A HUMAN
    A licence recorded only in a file cannot be rendered. `attribution` is the
    exact string the reader UI must show, and the loader writes it to
    data_sources so a joined query can return it with the text. That is what
    lets an attribution line exist at all.

THE SHARE-ALIKE COLUMN
    All four translations below are public domain, so `share_alike` is False on
    every one and decision Q-007's separability rule never fires for scripture.
    The column still exists because the enrichment corpora that will join
    against these verses (unfoldingWord, Theographic) are CC BY-SA, and the
    loaders for those must be able to say so in the same table.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SourceLicence:
    """What a translation's licence permits, and what it obliges us to show."""

    #: Short identifier for logs and the database. Not SPDX: no SPDX identifier
    #: means "public domain by age in most of the world, with a regional
    #: exception", which is precisely the KJV's situation.
    identifier: str
    #: Where the statement below was read.
    url: str
    #: True only for licences that force a derivative to carry the same terms.
    share_alike: bool
    #: The exact string the reader must display. Empty means the publisher
    #: requires none -- which is still worth showing, so the UI decides.
    attribution: str
    #: The publisher's own words, trimmed. Kept so a future reader can audit
    #: the judgement without re-fetching a page that may have changed.
    statement: str


KJV_LICENCE = SourceLicence(
    identifier="public-domain",
    url="https://ebible.org/Scriptures/details.php?id=eng-kjv2006",
    share_alike=False,
    attribution=(
        "King James (Authorized) Version. Public Domain. "
        "Courtesy of the CrossWire Bible Society and eBible.org."
    ),
    statement=(
        "Public Domain. Letters patent issued by King James with no expiration "
        "date means that to print this translation in the United Kingdom or "
        "import printed copies into the UK, you need permission. ... This royal "
        "decree has no effect outside of the UK, where this work is firmly in "
        "the Public Domain."
    ),
)
"""The UK letters-patent caveat is about PRINTING and importing printed copies
into the UK. Serving the text from a server is not printing, so it does not
bind us -- but it is recorded here rather than paraphrased away, because a
future decision to sell a printed edition would need to know."""

ASV_LICENCE = SourceLicence(
    identifier="public-domain",
    url="https://ebible.org/Scriptures/details.php?id=eng-asv",
    share_alike=False,
    attribution="American Standard Version (1901). Public Domain.",
    statement=(
        "Public Domain. The American Standard Version was published in 1901 and "
        "its copyright expired; eBible.org distributes it with no restrictions."
    ),
)

WEB_LICENCE = SourceLicence(
    identifier="public-domain",
    url="https://ebible.org/Scriptures/details.php?id=engwebp",
    share_alike=False,
    attribution=(
        "World English Bible. Public Domain. "
        '"World English Bible" is a trademark of eBible.org.'
    ),
    statement=(
        "The World English Bible is in the Public Domain. That means that it is "
        'not copyrighted. However, "World English Bible" is a Trademark of '
        "eBible.org. You may copy, publish, proclaim, distribute, redistribute, "
        "sell, give away, quote, memorize, read publicly, broadcast, transmit, "
        "share, back up, post on the Internet, print, reproduce, preach, teach "
        "from, and use the World English Bible as much as you want. ... All we "
        "ask is that if you CHANGE the actual text of the World English Bible in "
        "any way, you not call the result the World English Bible any more."
    ),
)
"""The trademark is on the NAME, not the text. We must not alter the text and
keep calling it the World English Bible -- which is why the loader applies no
text transformation to WEB at all (see translation_catalogue.py)."""

BSB_LICENCE = SourceLicence(
    identifier="public-domain",
    url="https://berean.bible/terms.htm",
    share_alike=False,
    attribution=(
        "The Holy Bible, Berean Standard Bible, BSB. Produced in cooperation "
        "with Bible Hub, Discovery Bible, OpenBible.com and the Berean Bible "
        "Translation Committee. Dedicated to the public domain."
    ),
    statement=(
        "The Berean Bible and Majority Bible texts are officially dedicated to "
        "the public domain as of April 30, 2023. All uses are freely permitted. "
        "Attribution Notice (appreciated but not required): The Holy Bible, "
        "Berean Standard Bible, BSB is produced in cooperation with Bible Hub, "
        "Discovery Bible, OpenBible.com, and the Berean Bible Translation "
        "Committee. This text of God's Word has been dedicated to the public "
        "domain."
    ),
)
"""Assumption Q-024 recorded the BSB's 2023 dedication as "a licence judgement,
not an engineering one" and shipped without it. The judgement is now made on
evidence: berean.bible/terms.htm states the dedication outright, and the
attribution above is the publisher's own suggested wording, offered as
appreciated-but-not-required. We show it anyway."""
