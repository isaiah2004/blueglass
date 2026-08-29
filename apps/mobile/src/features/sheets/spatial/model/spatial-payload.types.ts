/**
 * The two spatial payloads as the M2 API actually sends them.
 *
 * Purpose
 *   `packages/shared/src/badges/spatial-badge.types.ts` is the product-level model, and
 *   the server's `RoutePayloadOut` / `City3dPayloadOut` are the wire. They are close but
 *   not identical, and this module is where the difference is written down instead of
 *   being rediscovered by whoever wires the sheet host.
 *
 * The three deltas, and why they are not fixed here
 *   1. `MappedLocation` in `packages/shared/src/geo.ts` has `name`, `coordinates`, `role`
 *      and an optional `has3dReconstruction`. The API additionally sends `feature_type`,
 *      `place_id` and `verse_key` for every pin, and the sheets use all three — feature
 *      type picks the pin glyph, verse key is what "named in v11" is drawn from.
 *      {@link SpatialLocation} therefore **extends** the shared type rather than replacing
 *      it, so the shared shape stays the base of truth and the delta is one interface.
 *   2. `RouteBadgePayload` declares optional `distance` and `durationDays`. The server
 *      sends neither and sends `scheme` instead. Distance is derived here from the pins
 *      (`geo/distance.ts`); duration is not derivable and is not shown.
 *   3. `passage` is a pair of packed integers on the wire, not a `VerseKeyRange` of
 *      resolved `VerseKey` objects. Resolving it needs the book table, which is a decoder's
 *      job, not a sheet's — so the sheet takes the integers and formats them itself.
 *
 *   `packages/shared` is owned elsewhere in the fleet; when `geo.ts` grows the three
 *   fields, {@link SpatialLocation} collapses to an alias and nothing else changes.
 *
 * Dependencies
 *   `@atlas/shared` for the base geo and provenance types. Pure types, no runtime.
 */

import type { MapCamera, MappedLocation, SourceAttribution } from '@atlas/shared';

/**
 * A pin, with everything the API sends about it.
 *
 * Coordinates are `[longitude, latitude]` — GeoJSON order, inherited from the shared type.
 */
export interface SpatialLocation extends MappedLocation {
  /** What kind of place it is: `settlement`, `region`, `island`. Picks the pin glyph. */
  readonly featureType: string;
  /** The gazetteer's stable id, used as a React key and never displayed. */
  readonly placeId: string;
  /** The packed key of the verse that names it, so a pin can cite its own verse. */
  readonly verseKey: number;
}

/** A span of verses as the wire sends it: two packed integers, both ends inclusive. */
export interface PassageKeys {
  readonly startKey: number;
  readonly endKey: number;
}

/** Sheet content for `[Route]`, as the API sends it. */
export interface RouteSheetPayload {
  readonly kind: 'route';
  /** Human title of the journey, e.g. `Troas to Philippi`. Built by the server. */
  readonly title: string;
  /** The places, in travel order. The server guarantees at least two. */
  readonly waypoints: readonly SpatialLocation[];
  /** Where the camera opens. Computed by the server from the pins, never sourced. */
  readonly camera: MapCamera;
  /** The verses this journey spans. */
  readonly passage: PassageKeys;
  /** How the route was assembled, e.g. `chapter`. Shown as provenance, not as a claim. */
  readonly scheme: string;
}

/**
 * Sheet content for `[3D City]`, as the API sends it.
 *
 * `hasReconstruction` is `false` on every row M2 ships and is present anyway: `Q-008` and
 * `dataset-validation.md` §4.3 record that no openly-licensed 3D reconstruction of a
 * biblical city exists, and this flag is the interface a commissioned model drops into.
 * See `model/reconstruction.ts`.
 */
export interface CitySheetPayload {
  readonly kind: '3d-city';
  /** The site itself, with its gazetteer pin. */
  readonly location: SpatialLocation;
  /** Modern name of the site, when scholarship identifies one. */
  readonly modernName?: string | undefined;
  /** How many modern sites are proposed for this ancient place. Often more than one. */
  readonly identificationCount: number;
  /** How precisely the pin is known, e.g. `tel`, `site`, `region`. */
  readonly precisionType?: string | undefined;
  /** How many verses of the whole canon name this place. */
  readonly canonVerseCount: number;
  /** OSIS ids of the verses in THIS chapter that name it, e.g. `Acts.16.1`. */
  readonly mentionedAt: readonly string[];
  /** Whether a 3D reconstruction exists to load. `false` for every row M2 ships. */
  readonly hasReconstruction: boolean;
}

/**
 * What a spatial sheet needs beyond its payload.
 *
 * `sources` is not optional and not allowed to be empty. Decision `AI-05`: a badge that
 * cannot name its source and licence is not rendered, and the sheets enforce that at the
 * render boundary rather than trusting the server to have done it —
 * `model/attribution.ts` is where the check lives.
 */
export interface SpatialSheetSources {
  readonly sources: readonly SourceAttribution[];
}

/**
 * How much chrome a sheet draws around its own body.
 *
 * `full` — the sheet is standalone: it draws its heading and its source strip itself. This
 * is what `/spike/spatial-sheets` and any direct host get.
 *
 * `body` — the sheet is a **slot body** inside `features/reader/badges/BadgeDetail`, which
 * already draws the pill, the reference, the teaser, the evidence chips and the `AI-05`
 * attribution strip. Repeating them would print the sources twice under one badge, which
 * reads as a bug and dilutes the one thing `AI-05` is about. The map, the stats and the
 * facts are unchanged; only the surrounding chrome is dropped.
 */
export type SheetChrome = 'full' | 'body';
