/**
 * Provenance entries copied verbatim from the running API.
 *
 * Purpose
 *   `AI-05` says every badge names its source and licence. A fixture that made those up
 *   would let the sheets be developed against attribution that does not exist, which is the
 *   one thing this folder must never do. Every string below was read from
 *   `GET /badges/chapters/BSB/Acts/16` on 2026-08-29 and is reproduced unchanged.
 *
 * Test-only, and deliberately not exported from the folder's barrel.
 *
 * Dependencies
 *   `@atlas/shared` for `SourceAttribution`. Pure data.
 */

import type { SourceAttribution } from '@atlas/shared';

/** The Greek lexicon behind a `[Root]` badge's headword and counts. */
export const TBESG: SourceAttribution = {
  key: 'stepbible_tbesg',
  name: 'STEPBible TBESG — Translators Brief lexicon of Extended Strongs for Greek',
  license: 'CC-BY-4.0',
  attribution: 'STEP Bible — www.STEPBible.org (CC BY 4.0)',
  shareAlike: false,
  url: 'https://github.com/STEPBible/STEPBible-Data',
  version: 'TBESG, master branch; definitions after Abbott-Smith (1922, PD)',
  retrievedAt: '2026-08-28',
};

/** The Greek word layer the English-to-Greek alignment is computed over. */
export const TAGNT: SourceAttribution = {
  key: 'stepbible_tagnt',
  name: 'STEPBible TAGNT — Translators Amalgamated Greek New Testament',
  license: 'CC-BY-4.0',
  attribution: 'STEP Bible — www.STEPBible.org (CC BY 4.0)',
  shareAlike: false,
  url: 'https://github.com/STEPBible/STEPBible-Data',
  version: 'TAGNT Mat-Jhn + Act-Rev, master branch',
  retrievedAt: '2026-08-28',
};

/** The fuller definitions. Public domain, and the only CC0 source on the Root sheet. */
export const DODSON: SourceAttribution = {
  key: 'dodson_greek_lexicon',
  name: 'Dodson Greek Lexicon',
  license: 'CC0-1.0',
  attribution: 'Dodson Greek Lexicon — public domain (CC0 1.0)',
  shareAlike: false,
  url: 'https://github.com/biblicalhumanities/Dodson-Greek-Lexicon',
  version: 'master branch, last upstream push 2018-01-11',
  retrievedAt: '2026-08-28',
};

/**
 * The dating source behind `[History]`.
 *
 * The one share-alike licence in this folder. `Q-007` keeps it from triggering by never
 * redistributing the database, and `ASSUMPTIONS.md` `H-01` records the reasoning.
 */
export const THEOGRAPHIC: SourceAttribution = {
  key: 'theographic_events',
  name: 'Theographic Bible Metadata — Events',
  license: 'CC-BY-SA-4.0',
  attribution:
    'Event dating from Theographic Bible Metadata, CC BY-SA 4.0 — github.com/robertrouse/theographic-bible-metadata',
  shareAlike: true,
  url: 'https://github.com/robertrouse/theographic-bible-metadata',
  version: '2026-08-28',
};

/** Reign dates for the world axis. */
export const WIKIDATA_RULERS: SourceAttribution = {
  key: 'wikidata_rulers',
  name: 'Wikidata ruler reigns',
  license: 'CC0-1.0',
  attribution: 'Reign dates from Wikidata, CC0 1.0 — wikidata.org',
  shareAlike: false,
  url: 'https://query.wikidata.org/sparql',
  version: '2026-08-29',
};

/** Hajime Murai's division of the text — the `Q-015` source. */
export const MURAI: SourceAttribution = {
  key: 'murai_literary_structure',
  name: 'Literary Structure of the Bible (Hajime Murai)',
  license: 'CC-BY-4.0',
  attribution:
    'Literary structure analysis by Hajime Murai, CC BY 4.0 — bible.literarystructure.info',
  shareAlike: false,
  url: 'http://bible.literarystructure.info/bible/bible_e.html',
  version: '2022-02-24',
};

/** The cross-reference votes. */
export const OPENBIBLE_XREF: SourceAttribution = {
  key: 'openbible_xref',
  name: 'OpenBible.info Cross References',
  license: 'CC-BY-4.0',
  attribution: 'Cross-references © OpenBible.info, CC BY 4.0',
  shareAlike: false,
  url: 'https://a.openbible.info/data/cross-references.zip',
  version: '2026-08-24',
  retrievedAt: '2026-08-28',
};
