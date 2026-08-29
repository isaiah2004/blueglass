/**
 * `GET /badges/chapters/…` in, a chapter of renderable badges out.
 *
 * Purpose
 *   The envelope half of the badge contract: id, kind, anchor, teaser, citations, sources.
 *   `badge-payload-decoders.ts` owns the five sheet payloads; this file owns everything
 *   around them and the two rules that decide whether a badge is allowed to exist.
 *
 * Rule 1 — `AI-05`, structurally
 *   **A badge with an empty `sources` list is dropped.** Not rendered greyed out, not
 *   rendered without attribution: dropped, before any component can see it. "Every claim
 *   carries a source anchor or is not shown" is only true if something enforces it, and the
 *   cheapest place to enforce it is the moment the JSON stops being JSON.
 *
 * Rule 2 — one bad badge must not blank a chapter
 *   The chapter envelope decodes strictly; each badge inside it decodes independently, and a
 *   badge that fails is skipped and counted in `droppedCount`. Pillar 1 is a pristine reading
 *   canvas — a contract drift in one enrichment row must cost the reader that row, never the
 *   chapter. The count is what stops the skip being silent: this app has no logger, so the
 *   number rides along in the data where a test can assert on it.
 *
 * Dependencies
 *   `@atlas/shared`, `@/api` for the decoder combinators, and this folder's models,
 *   vocabularies and payload decoders. No HTTP, no React.
 */

import { succeed, type Citation, type SourceAttribution, type VerseKey } from '@atlas/shared';

import {
  decodeArray,
  decodeBoolean,
  decodeNullable,
  decodeNumber,
  decodeObject,
  decodeRecord,
  decodeString,
  type Decoder,
} from '@/api';

import { present } from './badge-optional-field';
import { decodeBadgePayload } from './badge-payload-decoders';
import { asCitationKind, asReaderBadgeKind } from './badge-vocabularies';
import { decodeVerseKey } from './badge-wire-leaves';
import type { ChapterBadges, ReaderBadge } from './badge-models';

interface SourceWire {
  key: string;
  name: string;
  license: string;
  attribution: string;
  share_alike: boolean;
  url: string | null;
  version: string | null;
  retrieved_at: string | null;
}

const decodeSourceWire = decodeObject<SourceWire>({
  key: decodeString,
  name: decodeString,
  license: decodeString,
  attribution: decodeString,
  share_alike: decodeBoolean,
  url: decodeNullable(decodeString),
  version: decodeNullable(decodeString),
  retrieved_at: decodeNullable(decodeString),
});

/** Wire source to the shared provenance record. `attribution` is never reworded. */
function toSource(wire: SourceWire): SourceAttribution {
  return {
    key: wire.key,
    name: wire.name,
    license: wire.license,
    attribution: wire.attribution,
    shareAlike: wire.share_alike,
    ...present('url', wire.url),
    ...present('version', wire.version),
    ...present('retrievedAt', wire.retrieved_at),
  };
}

const decodeSources = decodeArray(decodeSourceWire);

interface CitationWire {
  id: string;
  kind: string;
  label: string;
  osis: string | null;
  source_name: string | null;
  url: string | null;
}

const decodeCitationWire = decodeObject<CitationWire>({
  id: decodeString,
  kind: decodeString,
  label: decodeString,
  osis: decodeNullable(decodeString),
  source_name: decodeNullable(decodeString),
  url: decodeNullable(decodeString),
});

/** Wire citation to the shared evidence chip. */
function toCitation(wire: CitationWire): Citation {
  return {
    id: wire.id,
    kind: asCitationKind(wire.kind),
    label: wire.label,
    ...present('osis', wire.osis),
    ...present('sourceName', wire.source_name),
    ...present('url', wire.url),
  };
}

/** The anchor, with its packed key already resolved against the canon. */
interface AnchorWire {
  verse_key: VerseKey;
  text: string;
  start_offset: number;
  end_offset: number;
}

const decodeAnchorWire = decodeObject<AnchorWire>({
  verse_key: decodeVerseKey,
  text: decodeString,
  start_offset: decodeNumber,
  end_offset: decodeNumber,
});

/** The badge envelope, minus the payload — which needs the kind before it can be decoded. */
interface BadgeShellWire {
  id: string;
  kind: string;
  anchor: AnchorWire;
  teaser: string;
  citations: readonly CitationWire[];
  sources: readonly SourceWire[];
}

const decodeBadgeShellWire = decodeObject<BadgeShellWire>({
  id: decodeString,
  kind: decodeString,
  anchor: decodeAnchorWire,
  teaser: decodeString,
  citations: decodeArray(decodeCitationWire),
  sources: decodeSources,
});

/**
 * One badge, or `null` when this client must not render it.
 *
 * The four ways a badge is refused, in order: a shell that does not match the contract (which
 * includes a verse key outside the canon), a kind this client has no hue or glyph for,
 * `AI-05`'s no-provenance rule, and a payload that fails its own decoder.
 *
 * @param raw - One element of the `badges` array.
 * @param path - Dotted path, for the failure a strict decoder would have reported.
 * @returns The badge, or `null`. Side effects: none.
 */
export function decodeOneBadge(raw: unknown, path: string): ReaderBadge | null {
  const shell = decodeBadgeShellWire(raw, path);
  if (!shell.ok) return null;

  const kind = asReaderBadgeKind(shell.value.kind);
  if (kind === null) return null;
  if (shell.value.sources.length === 0) return null;

  const record = decodeRecord(raw, path);
  if (!record.ok) return null;
  const payload = decodeBadgePayload(kind)(record.value['payload'], `${path}.payload`);
  if (!payload.ok) return null;

  const badge = {
    id: shell.value.id,
    kind,
    anchor: {
      verse: shell.value.anchor.verse_key,
      text: shell.value.anchor.text,
      startOffset: shell.value.anchor.start_offset,
      endOffset: shell.value.anchor.end_offset,
    },
    teaser: shell.value.teaser,
    citations: shell.value.citations.map(toCitation),
    sources: shell.value.sources.map(toSource),
    payload: payload.value,
  };

  // The kind and the payload were produced by the same key of `PAYLOAD_DECODERS`, whose
  // mapped `satisfies` proves key by key that `route` yields a Route payload. The assertion
  // restates what the compiler already checked there; it cannot re-derive it across a
  // function boundary because `kind` is a value here, not a literal type.
  return badge as ReaderBadge;
}

interface ChapterWire {
  reference: string;
  translation: string;
  book_number: number;
  chapter: number;
  badges: readonly unknown[];
  sources: readonly SourceWire[];
}

const decodeChapterWire = decodeObject<ChapterWire>({
  reference: decodeString,
  translation: decodeString,
  book_number: decodeNumber,
  chapter: decodeNumber,
  badges: decodeArray((raw) => succeed(raw)),
  sources: decodeSources,
});

/**
 * `GET /badges/chapters/{translation}/{book}/{chapter}` → the chapter's renderable badges.
 *
 * An unenriched chapter answers `200` with an empty list, which decodes to an empty chapter
 * rather than to a failure — most of the canon looks like that today, and a client that
 * treated it as an error would show the reader a broken chapter instead of a plain one.
 */
export const decodeChapterBadges: Decoder<ChapterBadges> = (raw, path) => {
  const body = decodeChapterWire(raw, path);
  if (!body.ok) return body;

  const badges: ReaderBadge[] = [];
  let dropped = 0;
  body.value.badges.forEach((item, index) => {
    const badge = decodeOneBadge(item, `${path}.badges[${String(index)}]`);
    if (badge === null) {
      dropped += 1;
      return;
    }
    badges.push(badge);
  });

  return succeed({
    reference: body.value.reference,
    translation: body.value.translation,
    bookNumber: body.value.book_number,
    chapter: body.value.chapter,
    badges,
    sources: body.value.sources.map(toSource),
    droppedCount: dropped,
  });
};
