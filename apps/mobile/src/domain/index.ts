/**
 * The Expo client's domain layer.
 *
 * Purpose
 *   One import point — `@/domain` — for every piece of business meaning the app uses:
 *   where a passage is, what a badge is, what a pre-computed record contains. Screens,
 *   hooks, and stores import from here rather than from `@atlas/shared` directly, so
 *   that when app-only domain logic appears (reading-plan progress, streak arithmetic)
 *   it lands beside the shared types instead of forcing every call site to change.
 *
 * Key responsibilities
 *   - Re-export the shared domain vocabulary the client actually consumes.
 *   - Keep the list explicit, so what the app depends on is readable at a glance.
 *
 * Dependencies
 *   `@atlas/shared` only.
 *
 * Hard constraint (CLAUDE.md, "Hard limits")
 *   **The domain layer has zero infrastructure imports.** Nothing here may import React,
 *   React Native, Expo, a navigation library, a storage engine, or `fetch`. Anything
 *   that does belongs in `src/api`, `src/stores`, or a feature folder — not in this
 *   directory. The rule is what makes this layer testable under plain Node, which is why
 *   `vitest.config.ts` can run its tests without a React Native transform.
 */

// --- Results -----------------------------------------------------------------------
// Every fallible domain call returns one of these. Branch on `.ok`; never assume.
export type { FailureResult, Result, SuccessResult } from '@atlas/shared';
export { fail, succeed } from '@atlas/shared';

// --- Scripture ---------------------------------------------------------------------
// The canonical 66-book table and the verse identity the whole API keys off.
export type {
  BibleBook,
  BookNumber,
  CanonicalBook,
  ScriptureError,
  ScriptureErrorCode,
  Testament,
  Translation,
  VerseKey,
  VerseKeyRange,
  VerseReference,
} from '@atlas/shared';
export {
  bookFromAny,
  bookFromNumber,
  bookNumberFromAny,
  CANONICAL_BOOK_COUNT,
  CANONICAL_BOOKS,
  formatOsisId,
  formatVerseReference,
  makeVerseKey,
  normaliseBookToken,
  parseOsisPoint,
  parseOsisRange,
  toVerseReference,
  verseKeyFromNumber,
} from '@atlas/shared';

// --- Evidence ----------------------------------------------------------------------
// Pillar 3: every claim the app renders carries one of these, or it is not rendered.
export type { Citation, CitationKind, GroundingConfidence } from '@atlas/shared';

// --- Geography ---------------------------------------------------------------------
// `GeoCoordinates` is [longitude, latitude]. Read the note in `@atlas/shared/geo`
// before touching a map pin.
export type { GeoCoordinates, LocationRole, MapCamera, MappedLocation } from '@atlas/shared';

// --- Inline badges -----------------------------------------------------------------
// The reader's signature interaction. Narrow `InlineBadge` on `kind`, then close the
// switch with `assertBadgeHandled` so a new badge kind cannot be silently dropped.
export type {
  BadgeAnchor,
  BadgeKind,
  BadgeKindDescriptor,
  BadgeOfKind,
  BadgePayloadOfKind,
  InlineBadge,
} from '@atlas/shared';
export {
  assertBadgeHandled,
  BADGE_KIND_COUNT,
  BADGE_KIND_DESCRIPTORS,
  BADGE_KINDS,
  describeBadgeKind,
  isBadgeKind,
} from '@atlas/shared';

// --- Pre-computed enrichment -------------------------------------------------------
// What a reading-plan day loads and what the offline cache stores.
export type {
  PassageEnrichment,
  PassageId,
  PassageSpatialData,
  PassageStructuralData,
  PassageTemporalData,
} from '@atlas/shared';
export { formatPassageId, parsePassageId } from '@atlas/shared';
