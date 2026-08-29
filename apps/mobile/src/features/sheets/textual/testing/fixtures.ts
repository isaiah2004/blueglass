/**
 * Badge fixtures, captured from the running API.
 *
 * Purpose
 *   Component tests and the gallery screen both need badges that are true to what the
 *   server sends. Every payload below was read from `GET /badges/chapters/BSB/Acts/16` on
 *   2026-08-29 and converted to the client's camelCase shape without changing a value: the
 *   Greek is the Greek the lexicon holds, the vote counts are OpenBible's, the rationale is
 *   the sentence the builder composed.
 *
 * The one fixture that is NOT from the API, and why it exists
 *   {@link HEBREW_ROOT_PROBE}. No `[Root]` badge in the corpus is Hebrew — the word layer is
 *   Greek-only (`ingest_lexicon.py`), so right-to-left rendering has no live example to
 *   check against. A rendering path with no example is a rendering path nobody has looked
 *   at, and the failure mode (a row of empty rectangles, or a lemma laid out backwards) is
 *   invisible until the day Hebrew data lands. The probe is marked as synthetic wherever it
 *   is shown.
 *
 * Test and diagnostic use only. Not exported from the folder's barrel.
 *
 * Dependencies
 *   `@atlas/shared`, the folder's payload types, and `./fixture-sources`.
 */

import { verseKeyFromNumber, type VerseKey, type VerseKeyRange } from '@atlas/shared';

import type {
  CrossRefSheetBadge,
  HistorySheetBadge,
  RootSheetBadge,
} from '../model/textual-payloads';
import {
  DODSON,
  MURAI,
  OPENBIBLE_XREF,
  TAGNT,
  TBESG,
  THEOGRAPHIC,
  WIKIDATA_RULERS,
} from './fixture-sources';

/**
 * Decode a packed key, refusing to build a fixture around a bad one.
 *
 * Throwing is right here and nowhere else in this folder: a fixture with an invalid verse
 * key is a broken test asset, and failing at import is how that gets noticed immediately
 * rather than as a confusing assertion three files away.
 *
 * @param value - The packed integer.
 * @returns The decoded key.
 * @throws Error when the integer names no real verse.
 */
function fixtureKey(value: number): VerseKey {
  const result = verseKeyFromNumber(value);
  if (!result.ok) {
    throw new Error(`Fixture verse key ${String(value)} is not a verse: ${result.error.message}`);
  }

  return result.value;
}

/**
 * Build a span from two packed keys.
 *
 * @param startKey - Packed key of the first verse.
 * @param endKey - Packed key of the last verse.
 * @returns The span.
 */
function fixtureRange(startKey: number, endKey: number): VerseKeyRange {
  return { start: fixtureKey(startKey), end: fixtureKey(endKey) };
}

/** Acts 16:14 — the verse the PRD's own worked example lives in. */
export const ACTS_16_14 = fixtureKey(44016014);

/** The text of Acts 16:14 in the BSB, for the `[Root]` sheet's example row. */
export const ACTS_16_14_TEXT =
  'Among those listening was a woman named Lydia, a dealer in purple cloth from the city of Thyatira. She was a worshiper of God, and the Lord opened her heart to respond to Paul’s message.';

/** `[Root]` on `πορφυρόπωλις`, a word occurring once in the whole New Testament. */
export const ROOT_BADGE: RootSheetBadge = {
  id: 'root~44016014~11',
  kind: 'root',
  anchor: { verse: ACTS_16_14, text: 'dealer in purple', startOffset: 47, endOffset: 63 },
  teaser: 'πορφυρόπωλις - "dealer in purple", used once in the corpus',
  citations: [
    { id: 'root-0', kind: 'reference-work', label: TBESG.attribution, sourceName: TBESG.name },
    { id: 'root-1', kind: 'reference-work', label: DODSON.attribution, sourceName: DODSON.name },
  ],
  sources: [TBESG, TAGNT, DODSON],
  payload: {
    lemma: 'πορφυρόπωλις',
    language: 'greek',
    transliteration: 'porphuropōlis',
    strongsNumber: 'G4211',
    gloss: 'dealer in purple',
    surface: 'πορφυρόπωλις',
    occurrenceCount: 1,
    verseCount: 1,
    bookCount: 1,
    definition: 'a female seller of purple cloth.',
  },
};

/**
 * A synthetic Hebrew `[Root]`, for checking right-to-left rendering.
 *
 * `שָׁלוֹם` / `shalom` / `H7965` is a real lexicon entry; the counts are round numbers and
 * are not claims about the text. Nothing in the product renders this — only the gallery
 * screen and the component tests, both of which label it as a rendering probe.
 */
export const HEBREW_ROOT_PROBE: RootSheetBadge = {
  id: 'root~44016014~probe',
  kind: 'root',
  anchor: { verse: ACTS_16_14, text: 'peace', startOffset: 0, endOffset: 5 },
  teaser: 'Right-to-left rendering probe. Not from the corpus.',
  citations: [{ id: 'probe-0', kind: 'reference-work', label: TBESG.attribution }],
  sources: [TBESG],
  payload: {
    lemma: 'שָׁלוֹם',
    language: 'hebrew',
    transliteration: 'shalom',
    strongsNumber: 'H7965',
    gloss: 'peace, completeness',
    surface: 'שָׁלוֹם,',
    occurrenceCount: 10,
    verseCount: 9,
    bookCount: 4,
    definition: 'completeness, soundness, welfare, peace.',
  },
};

/** `[History]` on Acts 16:6-10, dated AD 47 with Claudius on the throne. */
export const HISTORY_BADGE: HistorySheetBadge = {
  id: 'history~44016006~murai:044016006-044016010',
  kind: 'history',
  anchor: { verse: fixtureKey(44016006), text: 'Galatia', startOffset: 137, endOffset: 144 },
  teaser: "AD 47 - Paul's vision of the man of Macedonia",
  citations: [
    { id: 'history-0', kind: 'reference-work', label: THEOGRAPHIC.attribution },
    { id: 'history-1', kind: 'reference-work', label: WIKIDATA_RULERS.attribution },
    { id: 'history-2', kind: 'reference-work', label: MURAI.attribution },
  ],
  sources: [THEOGRAPHIC, WIKIDATA_RULERS, MURAI],
  payload: {
    passageYearLabel: 'AD 47',
    passage: fixtureRange(44016006, 44016010),
    biblicalAxis: [
      {
        id: 'event-2809',
        label: 'Timothy Joins Paul and Silas',
        yearLabel: 'AD 47',
        sortYear: 47,
        detail: 'Second Missionary Journey',
      },
      {
        id: 'event-2810',
        label: 'Mission to Phrygia, Galatia and Asia',
        yearLabel: 'AD 47',
        sortYear: 47,
        detail: 'Second Missionary Journey',
      },
      {
        id: 'event-2811',
        label: 'Call to Macedonia',
        yearLabel: 'AD 47',
        sortYear: 47,
        detail: 'Second Missionary Journey',
      },
      {
        id: 'event-2812',
        label: "Lydia's Conversion",
        yearLabel: 'AD 47',
        sortYear: 47,
        detail: 'Second Missionary Journey',
      },
    ],
    worldAxis: [
      {
        id: 'ruler-348',
        label: 'Claudius, Emperor of Roman Empire',
        yearLabel: 'AD 41 to AD 54',
        sortYear: 41,
        detail: 'Roman Empire',
      },
      {
        id: 'ruler-379',
        label: 'Tiberius Julius Alexander, Procurator of Judaea',
        yearLabel: 'AD 46 to AD 48',
        sortYear: 46,
        detail: 'Judaea',
      },
    ],
    rationale:
      'Dated from the Theographic event Mission to Phrygia, Galatia and Asia (AD 47), which narrates about 60% of this passage.',
    datingOrigin: 'sourced',
    confidence: 0.6,
    rulerName: 'Claudius',
    passageTitle: "Paul's vision of the man of Macedonia",
    interpretiveClaim: "Murai's reading",
    attributedTo: 'Hajime Murai',
  },
};

/** `[Cross-Ref]` on Acts 16:31 — the strongest cross-reference in the chapter. */
export const CROSS_REF_BADGE: CrossRefSheetBadge = {
  id: 'cross-ref~44016031~openbible',
  kind: 'cross-ref',
  anchor: { verse: fixtureKey(44016031), text: 'household', startOffset: 78, endOffset: 87 },
  teaser: '6 linked passages, strongest John 1:12',
  citations: [
    { id: 'xref-source-0', kind: 'reference-work', label: OPENBIBLE_XREF.attribution },
    { id: 'xref-0', kind: 'scripture', label: 'John 1:12' },
  ],
  sources: [OPENBIBLE_XREF],
  payload: {
    relation: 'parallel',
    targets: [
      {
        range: fixtureRange(43001012, 43001012),
        displayReference: 'John 1:12',
        votes: 43,
        text: 'But to all who did receive Him, to those who believed in His name, He gave the right to become children of God—',
      },
      {
        range: fixtureRange(43003036, 43003036),
        displayReference: 'John 3:36',
        votes: 42,
        text: 'Whoever believes in the Son has eternal life. Whoever rejects the Son will not see life. Instead, the wrath of God remains on him.”',
      },
      {
        range: fixtureRange(44002038, 44002039),
        displayReference: 'Acts 2:38-39',
        votes: 39,
        text: 'Peter replied, “Repent and be baptized, every one of you, in the name of Jesus Christ for the forgiveness of your sins, and you will receive the gift of the Holy Spirit.',
      },
      {
        range: fixtureRange(45010009, 45010010),
        displayReference: 'Romans 10:9-10',
        votes: 38,
        text: 'that if you confess with your mouth, “Jesus is Lord,” and believe in your heart that God raised Him from the dead, you will be saved.',
      },
      {
        range: fixtureRange(44011013, 44011014),
        displayReference: 'Acts 11:13-14',
        votes: 26,
        text: 'He told us how he had seen an angel standing in his house and saying, ‘Send to Joppa for Simon who is called Peter.',
      },
      {
        range: fixtureRange(41016016, 41016016),
        displayReference: 'Mark 16:16',
        votes: 22,
        text: 'Whoever believes and is baptized will be saved, but whoever does not believe will be condemned.',
      },
    ],
  },
};
