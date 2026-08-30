/**
 * Decode `POST /assistant/ask`'s response body.
 *
 * Purpose
 *   Turn the wire shape (`AskOut` in `schemas.py`: `answer`, `citations[].verse_key`,
 *   `confidence`) into {@link AssistantAnswer} — the same "decode the wire shape, then
 *   rename" split `badge-decoders.ts` uses: a `*Wire` interface for what the server
 *   actually sends, a `toX` function for what the client actually wants.
 *
 * Dependencies
 *   `@atlas/shared` for `fail`/`succeed`, `@/api`'s decoder primitives, and this
 *   folder's models.
 */

import { fail, succeed } from '@atlas/shared';

import {
  decodeArray,
  decodeNullable,
  decodeNumber,
  decodeObject,
  decodeString,
  type Decoder,
} from '@/api';

import type { AssistantAnswer, AssistantCitation, GroundingConfidence } from './assistant-models';

interface CitationWire {
  label: string;
  verse_key: number | null;
  score: number;
}

const decodeCitationWire = decodeObject<CitationWire>({
  label: decodeString,
  verse_key: decodeNullable(decodeNumber),
  score: decodeNumber,
});

function toCitation(wire: CitationWire): AssistantCitation {
  return { label: wire.label, verseKey: wire.verse_key, score: wire.score };
}

/** The three grades the server can send. Anything else is a contract break. */
const CONFIDENCE_LEVELS: readonly GroundingConfidence[] = ['high', 'medium', 'low'];

/** Decode `confidence`, rejecting anything but the three known grades. */
const decodeGroundingConfidence: Decoder<GroundingConfidence> = (raw, path) => {
  const asString = decodeString(raw, path);
  if (!asString.ok) return asString;
  const match = CONFIDENCE_LEVELS.find((level) => level === asString.value);
  return match === undefined ? fail({ path, expected: 'one of "high", "medium", "low"' }) : succeed(match);
};

interface AskOutWire {
  answer: string;
  citations: readonly CitationWire[];
  confidence: GroundingConfidence;
}

const decodeAskOutWire = decodeObject<AskOutWire>({
  answer: decodeString,
  citations: decodeArray(decodeCitationWire),
  confidence: decodeGroundingConfidence,
});

/** Decode the whole `AskOut` body. */
export const decodeAssistantAnswer: Decoder<AssistantAnswer> = (raw, path) => {
  const wire = decodeAskOutWire(raw, path);
  if (!wire.ok) return wire;
  return succeed({
    answer: wire.value.answer,
    citations: wire.value.citations.map(toCitation),
    confidence: wire.value.confidence,
  });
};
