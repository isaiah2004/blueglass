/**
 * The small wire shapes the five payloads are built out of.
 *
 * Purpose
 *   Coordinates, pins, cameras, packed verse keys and verse ranges appear in more than one
 *   payload. Decoding each of them once — with its narrowing and its failure message — keeps
 *   `badge-payload-decoders.ts` a description of five payloads rather than a repetition of
 *   the same five leaves.
 *
 * Where the packed integers become verse keys
 *   The wire sends `44016011`; `@atlas/shared`'s `VerseKeyRange` wants resolved `VerseKey`
 *   objects, and so do the Cross-Ref and History sheets. Resolving needs the book table,
 *   which is a decoder's job and not a sheet's, so it happens here. A key the versification
 *   table does not recognise fails the decode, and the badge above it is dropped — a
 *   cross-reference to a verse the client cannot name is not a link, it is a dead end.
 *
 * Dependencies
 *   `@atlas/shared` for the verse-key resolver and the geo types, `@/api` for the decoder
 *   combinators, and this folder's vocabularies. No HTTP, no React.
 */

import { succeed, verseKeyFromNumber, type VerseKey, type VerseKeyRange } from '@atlas/shared';

import { decodeArray, decodeNumber, decodeObject, decodeString, type Decoder } from '@/api';

import { asLocationRole } from './badge-vocabularies';
import type { PassageKeys, SpatialLocation } from './badge-payloads';

/** Build the failure arm with this module's own phrasing. */
function reject(path: string, expected: string): ReturnType<Decoder<never>> {
  return { ok: false, error: { path, expected } };
}

/** A `[longitude, latitude]` pair — GeoJSON order — rejected unless it is exactly two. */
export const decodeCoordinates: Decoder<readonly [number, number]> = (raw, path) => {
  const pair = decodeArray(decodeNumber)(raw, path);
  if (!pair.ok) return pair;

  const [longitude, latitude] = pair.value;
  if (pair.value.length !== 2 || longitude === undefined || latitude === undefined) {
    return reject(path, 'two numbers, [longitude, latitude]');
  }
  return succeed([longitude, latitude] as const);
};

/** One packed verse key, resolved against the canon. */
export const decodeVerseKey: Decoder<VerseKey> = (raw, path) => {
  const value = decodeNumber(raw, path);
  if (!value.ok) return value;

  const key = verseKeyFromNumber(value.value);
  return key.ok ? succeed(key.value) : reject(path, 'a verse key inside the canon');
};

interface RangeWire {
  start_key: number;
  end_key: number;
}

const decodeRangeWire = decodeObject<RangeWire>({
  start_key: decodeNumber,
  end_key: decodeNumber,
});

/** A verse span as two packed integers — what the Route sheet takes. */
export const decodePassageKeys: Decoder<PassageKeys> = (raw, path) => {
  const wire = decodeRangeWire(raw, path);
  return wire.ok ? succeed({ startKey: wire.value.start_key, endKey: wire.value.end_key }) : wire;
};

/** A verse span with both endpoints resolved — what the Cross-Ref and History sheets take. */
export const decodeVerseKeyRange: Decoder<VerseKeyRange> = (raw, path) => {
  const record = decodeObject<{ start_key: VerseKey; end_key: VerseKey }>({
    start_key: decodeVerseKey,
    end_key: decodeVerseKey,
  })(raw, path);
  return record.ok ? succeed({ start: record.value.start_key, end: record.value.end_key }) : record;
};

interface LocationWire {
  name: string;
  coordinates: readonly [number, number];
  role: string;
  feature_type: string;
  place_id: string;
  verse_key: number;
}

const decodeLocationWire = decodeObject<LocationWire>({
  name: decodeString,
  coordinates: decodeCoordinates,
  role: decodeString,
  feature_type: decodeString,
  place_id: decodeString,
  verse_key: decodeNumber,
});

/**
 * One map pin.
 *
 * The role is narrowed rather than passed through: it is what decides the pin's glyph and the
 * shape of the route line, and an unrecognised value would draw a journey that never happened.
 */
export const decodeSpatialLocation: Decoder<SpatialLocation> = (raw, path) => {
  const wire = decodeLocationWire(raw, path);
  if (!wire.ok) return wire;

  const role = asLocationRole(wire.value.role);
  if (role === null) {
    return reject(`${path}.role`, 'departure, waypoint, island, or destination');
  }

  return succeed({
    name: wire.value.name,
    coordinates: wire.value.coordinates,
    role,
    featureType: wire.value.feature_type,
    placeId: wire.value.place_id,
    verseKey: wire.value.verse_key,
  });
};

/** Where the map opens. */
export const decodeMapCamera = decodeObject<{
  center: readonly [number, number];
  zoom_level: number;
}>({
  center: decodeCoordinates,
  zoom_level: decodeNumber,
});
