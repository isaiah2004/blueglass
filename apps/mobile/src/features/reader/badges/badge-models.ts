/**
 * One inline badge, and one chapter of them, as the reader holds them.
 *
 * Purpose
 *   The envelope around `badge-payloads.ts`: where the pill sits, what its one-line teaser
 *   says, and — the part that is not optional — where every claim came from.
 *
 * Built on `@atlas/shared`'s envelope, on purpose
 *   `InlineBadgeBase` is the product-level shape, and it is what the five sheet bodies in
 *   `features/sheets/` declare their props against. Composing the reader's badge out of it
 *   means a sheet registered through `badge-sheet-slot.tsx` receives exactly the type it
 *   asked for, with no adapter between the decoder and the component.
 *
 * `AI-05` lives in this file's types
 *   `sources` is non-empty by contract, and `badge-decoders.ts` enforces it by dropping any
 *   badge that arrives without one. That is the structural half of "every claim carries a
 *   source anchor or is not shown": a badge with no provenance cannot be constructed, so no
 *   component has to remember to check.
 *
 * Dependencies
 *   `@atlas/shared` for the envelope and provenance types, and this folder's payloads.
 *   No React, no I/O.
 */

import type { CrossRefBadgePayload, InlineBadgeBase, SourceAttribution } from '@atlas/shared';

import type {
  CitySheetPayload,
  HistorySheetPayload,
  RootSheetPayload,
  RouteSheetPayload,
} from './badge-payloads';

export type { BadgeAnchor, Citation, SourceAttribution } from '@atlas/shared';

/** The `[Route]` badge, envelope and all. */
export type RouteReaderBadge = InlineBadgeBase<'route', RouteSheetPayload>;

/** The `[3D City]` badge. */
export type CityReaderBadge = InlineBadgeBase<'3d-city', CitySheetPayload>;

/** The `[History]` badge. */
export type HistoryReaderBadge = InlineBadgeBase<'history', HistorySheetPayload>;

/** The `[Root]` badge. */
export type RootReaderBadge = InlineBadgeBase<'root', RootSheetPayload>;

/** The `[Cross-Ref]` badge. */
export type CrossRefReaderBadge = InlineBadgeBase<'cross-ref', CrossRefBadgePayload>;

/**
 * Any badge the reading canvas renders, discriminated on `kind`.
 *
 * Five, per decision `P-04`. The other six kinds the design language names have no wire
 * spelling yet, so they are absent from this union rather than present and unfillable.
 */
export type ReaderBadge =
  RouteReaderBadge | CityReaderBadge | HistoryReaderBadge | RootReaderBadge | CrossRefReaderBadge;

/** The five discriminants, in the wire's own spelling. */
export type ReaderBadgeKind = ReaderBadge['kind'];

/** The badge type belonging to one kind, e.g. `BadgeOfKind<'route'>` is a Route badge. */
export type BadgeOfKind<TKind extends ReaderBadgeKind> = Extract<ReaderBadge, { kind: TKind }>;

/** Every badge one chapter renders (`GET /badges/chapters/{translation}/{book}/{chapter}`). */
export interface ChapterBadges {
  /** Human reference, e.g. `Acts 16`. */
  readonly reference: string;
  readonly translation: string;
  readonly bookNumber: number;
  readonly chapter: number;
  /** In the server's order. A chapter with no enrichment sends an empty list and a 200. */
  readonly badges: readonly ReaderBadge[];
  /** Union of every source the badges rest on, for one attribution strip per chapter. */
  readonly sources: readonly SourceAttribution[];
  /**
   * How many badges the client could not draw and therefore dropped.
   *
   * A badge with no `sources` (`AI-05`), an unrecognised kind, a verse key outside the
   * versification table, or a payload that failed its decoder is skipped rather than allowed
   * to blank the chapter. This app has no structured logger yet, so the count is carried in
   * the data instead: a drop is then visible to a test and to a walkthrough, which is the
   * difference between resilience and a silent swallow (rule 6.1).
   */
  readonly droppedCount: number;
}

/** The answer for a chapter that has none. Shared so no caller allocates one. */
export const NO_CHAPTER_BADGES: readonly ReaderBadge[] = [];

/** No sources. Shared for the same reason. */
export const NO_BADGE_SOURCES: readonly SourceAttribution[] = [];
