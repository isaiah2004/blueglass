/**
 * The two spatial payloads: `[Route]` and `[3D City]`.
 *
 * Purpose
 *   Holds every snake_case field name `RoutePayloadOut` and `City3dPayloadOut` use, so the
 *   contract with `apps/api/app/modules/badges/presentation/schemas.py` can be read against
 *   this file side by side. A field renamed there fails here with the field's own name in the
 *   message, rather than as an `undefined` inside a map.
 *
 * Dependencies
 *   `@atlas/shared`, `@/api` for the decoder combinators, and this folder's leaves and payload
 *   types. No HTTP, no React.
 */

import { succeed } from '@atlas/shared';

import {
  decodeArray,
  decodeBoolean,
  decodeNullable,
  decodeNumber,
  decodeObject,
  decodeString,
  type Decoder,
} from '@/api';

import { present } from './badge-optional-field';
import type { CitySheetPayload, RouteSheetPayload, SpatialLocation } from './badge-payloads';
import { decodeMapCamera, decodePassageKeys, decodeSpatialLocation } from './badge-wire-leaves';

const decodeRouteWire = decodeObject<{
  title: string;
  waypoints: readonly SpatialLocation[];
  camera: { center: readonly [number, number]; zoom_level: number };
  passage: { startKey: number; endKey: number };
  scheme: string;
}>({
  title: decodeString,
  waypoints: decodeArray(decodeSpatialLocation),
  camera: decodeMapCamera,
  passage: decodePassageKeys,
  scheme: decodeString,
});

/** `[Route]` — a journey across the map. */
export const decodeRoutePayload: Decoder<RouteSheetPayload> = (raw, path) => {
  const wire = decodeRouteWire(raw, path);
  if (!wire.ok) return wire;

  return succeed({
    kind: 'route',
    title: wire.value.title,
    waypoints: wire.value.waypoints,
    camera: { center: wire.value.camera.center, zoomLevel: wire.value.camera.zoom_level },
    passage: wire.value.passage,
    scheme: wire.value.scheme,
  });
};

const decodeCityWire = decodeObject<{
  location: SpatialLocation;
  modern_name: string | null;
  identification_count: number;
  precision_type: string | null;
  named_verse_count: number;
  mentioned_at: readonly string[];
  has_reconstruction: boolean;
}>({
  location: decodeSpatialLocation,
  modern_name: decodeNullable(decodeString),
  identification_count: decodeNumber,
  precision_type: decodeNullable(decodeString),
  named_verse_count: decodeNumber,
  mentioned_at: decodeArray(decodeString),
  has_reconstruction: decodeBoolean,
});

/** `[3D City]` — the site, as far as the gazetteer allows. */
export const decodeCityPayload: Decoder<CitySheetPayload> = (raw, path) => {
  const wire = decodeCityWire(raw, path);
  if (!wire.ok) return wire;

  return succeed({
    kind: '3d-city',
    location: wire.value.location,
    identificationCount: wire.value.identification_count,
    namedVerseCount: wire.value.named_verse_count,
    mentionedAt: wire.value.mentioned_at,
    hasReconstruction: wire.value.has_reconstruction,
    ...present('modernName', wire.value.modern_name),
    ...present('precisionType', wire.value.precision_type),
  });
};
