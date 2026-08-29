/**
 * The badge layer of the reading canvas, as one import path.
 *
 * Purpose
 *   Everything that turns `GET /badges/chapters/…` into pills inside scripture: the models,
 *   the decoders, the query, the density rule, and the two surfaces a tapped pill opens.
 *   `features/reader/` imports from here; nothing outside `features/reader/` reaches past
 *   this file (rule 5.3.3) — with one deliberate exception, `BadgeSheetProvider`, which is
 *   how the five sheet bodies in `features/sheets/` register themselves without either side
 *   importing the other.
 *
 * The five badges, and why only five
 *   Decision `P-04`: Route, 3D City, History, Root, Cross-Ref. Decision `AI-07`: their content
 *   is pre-computed from deterministic datasets, so no LLM is involved on this path at all.
 *
 * One vocabulary
 *   The badge records here are `@atlas/shared`'s `InlineBadgeBase` envelopes carrying the
 *   payload shapes `features/sheets/` declares. A sheet registered through the slot receives
 *   exactly the type it asked for, with no adapter in between.
 */

export { badgeApi, createBadgeApi, type BadgeApi, type BadgeChapterAddress } from './badge-api';

export { decodeChapterBadges, decodeOneBadge } from './badge-decoders';

export { badgeHueKind, SHIPPED_BADGE_KINDS, themeBadgeKind } from './badge-kinds';

export { NO_BADGE_SOURCES, NO_CHAPTER_BADGES } from './badge-models';
export type {
  BadgeAnchor,
  BadgeOfKind,
  ChapterBadges,
  Citation,
  CityReaderBadge,
  CrossRefReaderBadge,
  HistoryReaderBadge,
  ReaderBadge,
  ReaderBadgeKind,
  RootReaderBadge,
  RouteReaderBadge,
  SourceAttribution,
} from './badge-models';

export type {
  BadgePayload,
  CitySheetPayload,
  CrossRefBadgePayload,
  HistoryBadgePayload,
  HistorySheetPayload,
  MapCamera,
  OriginalLanguage,
  PassageKeys,
  RootSheetPayload,
  RouteSheetPayload,
  SpatialLocation,
} from './badge-payloads';

export { attributionLines, type AttributionLine } from './attribution-lines';

export { attributedTeaserLabel, interpretiveClaimOf, type InterpretiveClaim } from './badge-claim';

export { badgeReference } from './badge-reference';

export {
  BadgeSheetProvider,
  NO_BADGE_SHEET_ACTIONS,
  useBadgeSheetRenderer,
  type BadgeSheetActions,
  type BadgeSheetProviderProps,
  type BadgeSheetRenderer,
  type BadgeSheetRenderers,
  type BadgeSheetTarget,
} from './badge-sheet-slot';

export {
  asCitationKind,
  asCrossReferenceRelation,
  asDatingOrigin,
  asLocationRole,
  asOriginalLanguage,
  asReaderBadgeKind,
  READER_BADGE_KINDS,
  type CrossReferenceRelation,
  type DatingOrigin,
} from './badge-vocabularies';

export {
  anchorsByVerseKey,
  badgesById,
  inlineBadgeCount,
  MAX_INLINE_BADGES_PER_VERSE,
  NO_VERSE_BADGES,
  type VerseBadgeMap,
} from './chapter-badges';

export { useBadgeSelection, type BadgeSelection } from './use-badge-selection';

export { useChapterBadgesQuery, type ChapterBadgesOptions } from './use-chapter-badges';

export { BadgeAttribution } from './BadgeAttribution';
export { BadgeClaimMark } from './BadgeClaimMark';
export { BadgeDetail } from './BadgeDetail';
export { distinctEvidence } from './badge-evidence';
export { BadgeEvidence } from './BadgeEvidence';
export { BadgePill } from './BadgePill';
export { BadgeSheet } from './BadgeSheet';
export { BadgeSummaryRow } from './BadgeSummaryRow';
export { ChapterBadgeSummary } from './ChapterBadgeSummary';
