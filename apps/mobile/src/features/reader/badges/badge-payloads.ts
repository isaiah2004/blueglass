/**
 * The five sheet payloads, as the M2 API actually sends them.
 *
 * Purpose
 *   `packages/shared/src/badges/` is the product-level model and the server's
 *   `schemas.py` is the wire. Where the two already agree, this module re-exports the
 *   shared type rather than restating it; where they differ, it states the difference once,
 *   here, so the reader's decoder and the sheet components are looking at the same shape.
 *
 * Written to meet the sheets, deliberately
 *   `features/sheets/spatial/model/spatial-payload.types.ts` and
 *   `features/sheets/textual/model/textual-payloads.ts` declare what the five sheet bodies
 *   consume. These types are structurally identical to those, which is what lets a sheet
 *   registered through `badge-sheet-slot.tsx` take a decoded badge with no adapter in
 *   between. Two badge models in one app would be a bug factory; there is one.
 *
 * The three deltas from `@atlas/shared`, unchanged from the sheets' own reading of them
 *   1. `MappedLocation` has no `featureType`, `placeId` or `verseKey`; the API sends all
 *      three and the sheets use all three, so {@link SpatialLocation} extends it.
 *   2. `RouteBadgePayload` declares `distance` and `durationDays`, which the server does not
 *      send, and omits `scheme`, which it does.
 *   3. `RootBadgePayload` predates the lexicon ingest — it asks for fields no endpoint serves
 *      and lacks four the endpoint does. {@link RootSheetPayload} mirrors the endpoint.
 *
 * Dependencies
 *   `@atlas/shared` only. Pure types.
 */

import type {
  CrossRefBadgePayload,
  HistoryBadgePayload,
  MapCamera,
  MappedLocation,
  OriginalLanguage,
  VerseKeyRange,
} from '@atlas/shared';

export type { CrossRefBadgePayload, HistoryBadgePayload, MapCamera, OriginalLanguage };

/**
 * A pin, with everything the API sends about it.
 *
 * Coordinates are `[longitude, latitude]` — GeoJSON order, inherited from the shared type.
 * Swapping them drops every pin in the wrong hemisphere, which is why the order is stated
 * on the type rather than left to a comment at the call site.
 */
export interface SpatialLocation extends MappedLocation {
  /** What kind of place it is: `settlement`, `region`, `island`. Picks the pin glyph. */
  readonly featureType: string;
  /** The gazetteer's stable id, used as a React key and never displayed. */
  readonly placeId: string;
  /** The packed key of the verse that names it, so a pin can cite its own verse. */
  readonly verseKey: number;
  /**
   * How many different ancient places carry this name — nine are called Ramah.
   *
   * `DECISIONS.md` #10: above 1 the sheet must say the name is shared rather than
   * present one of them as the settled identification.
   */
  readonly sharedNameCount: number;
  /** How many modern sites scholarship proposes for THIS place. 777 of 1,342 have >1. */
  readonly candidateCount: number;
}

/** A span of verses as the wire sends it: two packed integers, both ends inclusive. */
export interface PassageKeys {
  readonly startKey: number;
  readonly endKey: number;
}

/** Sheet content for `[Route]`. */
export interface RouteSheetPayload {
  readonly kind: 'route';
  /** Human title of the journey, e.g. `Derbe to Thyatira`. Built by the server. */
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
 * Sheet content for `[3D City]` — the site, not a reconstruction.
 *
 * `hasReconstruction` is `false` on every row M2 ships and is present anyway: no
 * openly-licensed 3D reconstruction of a biblical city exists (`dataset-validation.md` §4.3),
 * and the flag is the interface a commissioned model drops into later.
 */
export interface CitySheetPayload {
  readonly kind: '3d-city';
  readonly location: SpatialLocation;
  readonly modernName?: string;
  /** How many modern sites scholarship proposes for this ancient place. Often more than one. */
  readonly identificationCount: number;
  /** How precisely the pin is known, e.g. `tel`, `site`, `region`. */
  readonly precisionType?: string;
  /**
   * How many verses of the whole canon SPELL this place's name.
   *
   * Namings, not references. `place_mentions` also records people_group,
   * common_noun and no_translation rows, and counting those had the sheet say
   * Jerusalem is named in 955 verses where 766 spell it.
   */
  readonly namedVerseCount: number;
  /** OSIS ids of the verses in THIS chapter that name it, e.g. `Acts.16.1`. */
  readonly mentionedAt: readonly string[];
  readonly hasReconstruction: boolean;
}

/**
 * Sheet content for `[Root]` — one original-language word.
 *
 * Every optional field is genuinely absent for some rows: TBESG has no transliteration for
 * some headwords, and a handful of Strong's numbers minted from TAGNT carry no long
 * definition at all (`ASSUMPTIONS.md`, `L-04`).
 */
export interface RootSheetPayload {
  /** The headword in its own script, e.g. `πορφυρόπωλις`. */
  readonly lemma: string;
  /** Which script it is. Decides reading direction — Hebrew and Aramaic are RTL. */
  readonly language: OriginalLanguage;
  readonly transliteration?: string;
  /** Strong's number with its language prefix, e.g. `G4211`. */
  readonly strongsNumber: string;
  readonly gloss: string;
  /** The word as *this* verse's original text spells it — inflected, often punctuated. */
  readonly surface: string;
  readonly occurrenceCount: number;
  readonly verseCount: number;
  readonly bookCount: number;
  readonly definition?: string;
  readonly morphology?: string;
}

/**
 * Sheet content for `[History]`, plus the verse span the dating applies to.
 *
 * `HistoryBadgePayload` is otherwise an exact match for the endpoint; only `passage` is
 * missing there, and the sheet uses it to print which verses the date covers rather than
 * implying it covers the whole chapter.
 */
export interface HistorySheetPayload extends HistoryBadgePayload {
  readonly passage?: VerseKeyRange;
}

/** Any badge's sheet content. Discriminated by the badge envelope's `kind`, never its own. */
export type BadgePayload =
  | RouteSheetPayload
  | CitySheetPayload
  | HistorySheetPayload
  | RootSheetPayload
  | CrossRefBadgePayload;
