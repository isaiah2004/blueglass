/**
 * Payloads for the two spatial badges: Route and 3D City.
 *
 * Purpose
 *   `docs/product/prd.md` "Tab 2" specifies the Spatial Sheet — an embedded 3D Mapbox
 *   map panning over terrain with glowing route lines and golden city pins, headed by a
 *   stat strip reading "Distance: 125 Miles | Duration: 2 Days". These types are the
 *   data that sheet needs and nothing more.
 *
 * Key responsibilities
 *   - Describe a journey as an ordered list of places plus a camera to open on.
 *   - Describe a single reconstructed city, which is a different sheet, not a one-stop
 *     route — hence two payloads rather than one with optional halves.
 *
 * Dependencies
 *   `../geo`, `../scripture`, `./badge-envelope.types`, `./badge-kind`. Pure types.
 *
 * Note
 *   Distance and duration are optional because the enrichment pipeline can only supply
 *   them for journeys scripture actually times. The sheet hides the stat strip rather
 *   than inventing a number — pillar 3 applies to figures as much as to prose.
 */

import type { MapCamera, MappedLocation } from '../geo';
import type { VerseKeyRange } from '../scripture';
import type { InlineBadgeBase } from './badge-envelope.types';

/** How far a journey went, in the unit the mockups print. */
export interface JourneyDistance {
  /** Great-circle or sailed distance, whichever the source gives. */
  readonly miles: number;
  /** Which of those two this is, so the sheet can caption it honestly. */
  readonly measurement: 'straight-line' | 'travelled';
}

/** Sheet content for `[🗺️ Route]` — a journey across the map. */
export interface RouteBadgePayload {
  /** Human title of the journey, e.g. `Troas to Philippi`. */
  readonly title: string;
  /** The places, in travel order. At least two, or it is not a route. */
  readonly waypoints: readonly MappedLocation[];
  /** Where the camera opens, framing the whole journey. */
  readonly camera: MapCamera;
  /** The verses this journey spans, for the "read the passage" action on the sheet. */
  readonly passage: VerseKeyRange;
  /** How far, when the sources support a figure. */
  readonly distance?: JourneyDistance;
  /** How long, in days, when scripture or a source states it. */
  readonly durationDays?: number;
}

/** One notable structure inside a reconstructed city. */
export interface CityLandmark {
  /** Stable identifier within the reconstruction. */
  readonly id: string;
  /** What it is called, e.g. `The Forum`. */
  readonly name: string;
  /** One sentence on why it matters to this passage. */
  readonly summary: string;
}

/** Sheet content for `[🏛️ 3D City]` — one city, reconstructed. */
export interface City3dBadgePayload {
  /** The city itself. `has3dReconstruction` is true by definition for this badge. */
  readonly location: MappedLocation;
  /**
   * Key of the 3D asset package to load. The asset itself is fetched by the rendering
   * layer; the domain only names it, so this module stays free of I/O.
   */
  readonly reconstructionId: string;
  /** The period the reconstruction depicts, e.g. `Roman colony, c. AD 50`. */
  readonly eraLabel: string;
  /** One paragraph on the city's character at that time. */
  readonly summary: string;
  /** Structures worth pointing the camera at. May be empty. */
  readonly landmarks: readonly CityLandmark[];
}

/** The `[🗺️ Route]` badge, ready to render. */
export type RouteBadge = InlineBadgeBase<'route', RouteBadgePayload>;

/** The `[🏛️ 3D City]` badge, ready to render. */
export type City3dBadge = InlineBadgeBase<'3d-city', City3dBadgePayload>;
