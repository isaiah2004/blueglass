/**
 * The three textual payloads: `[History]`, `[Root]` and `[Cross-Ref]`.
 *
 * Purpose
 *   Holds every snake_case field name `HistoryPayloadOut`, `RootPayloadOut` and
 *   `CrossRefPayloadOut` use, so the contract with the server's schemas can be read against
 *   this file side by side.
 *
 * Two vocabularies are narrowed rather than trusted
 *   A word's `language` and a passage's `dating_origin` both fail closed
 *   (`badge-vocabularies.ts`): an unrecognised language would set the wrong reading direction,
 *   and an unrecognised dating origin would let a guess read as sourced. `AI-05`, applied to a
 *   single field.
 *
 * `Q-015` passes through untouched
 *   `passageTitle` is one scholar's heading and travels with `interpretiveClaim` and
 *   `attributedTo`. All three are forwarded exactly as sent; nothing here composes a sentence
 *   about them, because the sheet must be free to render the attribution beside the claim
 *   rather than beneath it.
 *
 * Dependencies
 *   `@atlas/shared`, `@/api` for the decoder combinators, and this folder's leaves,
 *   vocabularies and payload types. No HTTP, no React.
 */

import { succeed, type CrossReferenceTarget, type VerseKeyRange } from '@atlas/shared';

import {
  decodeArray,
  decodeNullable,
  decodeNumber,
  decodeObject,
  decodeString,
  type Decoded,
  type Decoder,
} from '@/api';

import { present } from './badge-optional-field';
import type { CrossRefBadgePayload, HistorySheetPayload, RootSheetPayload } from './badge-payloads';
import { asCrossReferenceRelation, asDatingOrigin, asOriginalLanguage } from './badge-vocabularies';
import { decodeVerseKeyRange } from './badge-wire-leaves';

/** Build the failure arm. */
function reject(path: string, expected: string): Decoded<never> {
  return { ok: false, error: { path, expected } };
}

interface EventWire {
  id: string;
  label: string;
  year_label: string;
  sort_year: number;
  detail: string | null;
}

const decodeEventWire = decodeObject<EventWire>({
  id: decodeString,
  label: decodeString,
  year_label: decodeString,
  sort_year: decodeNumber,
  detail: decodeNullable(decodeString),
});

/** One timeline node. `sortYear` is ordering only and is never rendered. */
function toEvent(wire: EventWire): HistorySheetPayload['biblicalAxis'][number] {
  return {
    id: wire.id,
    label: wire.label,
    yearLabel: wire.year_label,
    sortYear: wire.sort_year,
    ...present('detail', wire.detail),
  };
}

const decodeHistoryWire = decodeObject<{
  passage_year_label: string;
  passage: VerseKeyRange;
  biblical_axis: readonly EventWire[];
  world_axis: readonly EventWire[];
  rationale: string;
  dating_origin: string;
  confidence: number | null;
  ruler_name: string | null;
  passage_title: string | null;
  interpretive_claim: string | null;
  attributed_to: string | null;
}>({
  passage_year_label: decodeString,
  passage: decodeVerseKeyRange,
  biblical_axis: decodeArray(decodeEventWire),
  world_axis: decodeArray(decodeEventWire),
  rationale: decodeString,
  dating_origin: decodeString,
  confidence: decodeNullable(decodeNumber),
  ruler_name: decodeNullable(decodeString),
  passage_title: decodeNullable(decodeString),
  interpretive_claim: decodeNullable(decodeString),
  attributed_to: decodeNullable(decodeString),
});

/**
 * `[History]` — the dual-axis timeline.
 *
 * `Q-015`: `passageTitle` is one scholar's heading and travels with `interpretiveClaim` and
 * `attributedTo`. All three are passed through exactly as sent; nothing here composes a
 * sentence about them, because the sheet must be free to render the attribution beside the
 * claim rather than beneath it.
 */
export const decodeHistoryPayload: Decoder<HistorySheetPayload> = (raw, path) => {
  const wire = decodeHistoryWire(raw, path);
  if (!wire.ok) return wire;

  const origin = asDatingOrigin(wire.value.dating_origin);
  if (origin === null) {
    return reject(`${path}.dating_origin`, 'sourced, generated, or authored');
  }

  return succeed({
    passageYearLabel: wire.value.passage_year_label,
    passage: wire.value.passage,
    biblicalAxis: wire.value.biblical_axis.map(toEvent),
    worldAxis: wire.value.world_axis.map(toEvent),
    rationale: wire.value.rationale,
    datingOrigin: origin,
    ...present('confidence', wire.value.confidence),
    ...present('rulerName', wire.value.ruler_name),
    ...present('passageTitle', wire.value.passage_title),
    ...present('interpretiveClaim', wire.value.interpretive_claim),
    ...present('attributedTo', wire.value.attributed_to),
  });
};

const decodeRootWire = decodeObject<{
  lemma: string;
  language: string;
  transliteration: string | null;
  strongs_number: string;
  gloss: string;
  surface: string;
  occurrence_count: number;
  verse_count: number;
  book_count: number;
  definition: string | null;
  morphology: string | null;
}>({
  lemma: decodeString,
  language: decodeString,
  transliteration: decodeNullable(decodeString),
  strongs_number: decodeString,
  gloss: decodeString,
  surface: decodeString,
  occurrence_count: decodeNumber,
  verse_count: decodeNumber,
  book_count: decodeNumber,
  definition: decodeNullable(decodeString),
  morphology: decodeNullable(decodeString),
});

/** `[Root]` — one original-language word. */
export const decodeRootPayload: Decoder<RootSheetPayload> = (raw, path) => {
  const wire = decodeRootWire(raw, path);
  if (!wire.ok) return wire;

  const language = asOriginalLanguage(wire.value.language);
  if (language === null) {
    return reject(`${path}.language`, 'greek, hebrew, or aramaic');
  }

  return succeed({
    lemma: wire.value.lemma,
    language,
    strongsNumber: wire.value.strongs_number,
    gloss: wire.value.gloss,
    surface: wire.value.surface,
    occurrenceCount: wire.value.occurrence_count,
    verseCount: wire.value.verse_count,
    bookCount: wire.value.book_count,
    ...present('transliteration', wire.value.transliteration),
    ...present('definition', wire.value.definition),
    ...present('morphology', wire.value.morphology),
  });
};

const decodeTargetWire = decodeObject<{
  range: VerseKeyRange;
  display_reference: string;
  votes: number;
  text: string | null;
}>({
  range: decodeVerseKeyRange,
  display_reference: decodeString,
  votes: decodeNumber,
  text: decodeNullable(decodeString),
});

/** One linked passage, both endpoints preserved. */
const decodeTarget: Decoder<CrossReferenceTarget> = (raw, path) => {
  const wire = decodeTargetWire(raw, path);
  if (!wire.ok) return wire;

  return succeed({
    range: wire.value.range,
    displayReference: wire.value.display_reference,
    votes: wire.value.votes,
    ...present('text', wire.value.text),
  });
};

const decodeCrossRefWire = decodeObject<{
  relation: string;
  targets: readonly CrossReferenceTarget[];
}>({
  relation: decodeString,
  targets: decodeArray(decodeTarget),
});

/** `[Cross-Ref]` — vote-ranked links to related scripture. */
export const decodeCrossRefPayload: Decoder<CrossRefBadgePayload> = (raw, path) => {
  const wire = decodeCrossRefWire(raw, path);
  if (!wire.ok) return wire;

  const relation = asCrossReferenceRelation(wire.value.relation);
  if (relation === null) {
    return reject(`${path}.relation`, 'quotation, allusion, fulfilment, or parallel');
  }
  return succeed({ relation, targets: wire.value.targets });
};
