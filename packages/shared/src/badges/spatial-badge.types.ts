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

/**
 * Sheet content for `[🏛️ 3D City]` — one site, as far as the sources allow.
 *
 * REVISED FOR M2, and the revision is the point.
 *   `docs/architecture/dataset-validation.md` §4.3 records a confirmed negative: no
 *   openly-licensed 3D reconstruction of any biblical city exists. The nearest candidate
 *   is CC BY-NC-ND, which fails `DECISIONS.md` #3 on NonCommercial and fails again on
 *   NoDerivatives. So the four reconstruction fields became OPTIONAL — they are the
 *   interface a commissioned model drops into later — and the fields that ship today
 *   describe the SITE, every one of them a column of the gazetteer under CC BY 4.0.
 *
 *   Filling `summary` or `eraLabel` from a model would be exactly the pillar-3 violation
 *   the whole product is built to avoid, so the server never sets them.
 */
export interface City3dBadgePayload {
  /** The city itself, with its gazetteer pin. */
  readonly location: MappedLocation;
  /** Whether a reconstruction exists to load. False for every row M2 ships. */
  readonly hasReconstruction: boolean;
  /** Modern name of the site, when one is identified. */
  readonly modernName?: string;
  /**
   * How many modern sites scholarship proposes for this ancient place. 777 of the 1,342
   * ancient places have more than one; `DECISIONS.md` #10 forbids hiding that behind a
   * single confident pin, so the count is part of the payload, not a footnote.
   */
  readonly identificationCount: number;
  /** How precisely the pin is known, e.g. `site`, `region`. */
  readonly precisionType?: string;
  /**
   * How many verses of the whole canon SPELL this place's name.
   *
   * Namings, not references. `place_mentions` also records people_group,
   * common_noun and no_translation rows, and counting those had the sheet say
   * Jerusalem is named in 955 verses where 766 spell it.
   */
  readonly namedVerseCount: number;
  /** OSIS ids of the verses in THIS chapter that name it. */
  readonly mentionedAt: readonly string[];
  /**
   * Key of the 3D asset package to load. Absent until a reconstruction is commissioned;
   * present, it is fetched by the rendering layer, so the domain only names it.
   */
  readonly reconstructionId?: string;
  /** The period a reconstruction depicts, e.g. `Roman colony, c. AD 50`. */
  readonly eraLabel?: string;
  /** One paragraph on the city's character at that time. */
  readonly summary?: string;
  /** Structures worth pointing the camera at. */
  readonly landmarks?: readonly CityLandmark[];
}

/** The `[🗺️ Route]` badge, ready to render. */
export type RouteBadge = InlineBadgeBase<'route', RouteBadgePayload>;

/** The `[🏛️ 3D City]` badge, ready to render. */
export type City3dBadge = InlineBadgeBase<'3d-city', City3dBadgePayload>;
