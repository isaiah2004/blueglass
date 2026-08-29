/**
 * The inline badge union — the app's signature interaction, as one closed type.
 *
 * Purpose
 *   Tapping a badge inside scripture slides up a sheet whose entire content depends on
 *   which badge it was (`docs/product/prd.md` "Tab 2"). Modelling that as a discriminated
 *   union means the sheet router cannot open a Route sheet on a Root badge, and adding a
 *   twelfth badge kind produces compile errors at every place that must handle it —
 *   which is exactly where the work is.
 *
 * Key responsibilities
 *   - Assemble the eleven badge types into one union discriminated by `kind`.
 *   - Provide the exhaustiveness guard a `switch` over that union ends with.
 *   - Re-export the badge vocabulary, so nothing imports `badges/*` directly.
 *
 * Why this file sits beside a folder of the same name
 *   Eleven payload shapes do not fit in 300 lines (CLAUDE.md, "Hard limits"), so they
 *   are grouped by sheet family in `badges/`. This module is that folder's barrel.
 *
 * Count discrepancy
 *   Eleven kinds, though the PRD's prose says ten. See `badges/badge-kind.ts` for the
 *   reconciliation and the queued question.
 */

import type { City3dBadge, RouteBadge } from './badges/spatial-badge.types';
import type { ContextBadge, CulturalBadge, HistoryBadge } from './badges/historical-badge.types';
import type { CrossRefBadge, ManuscriptBadge, RootBadge } from './badges/textual-badge.types';
import type { LineageBadge, MeditateBadge, StructureBadge } from './badges/literary-badge.types';
import type { BadgeKind } from './badges/badge-kind';

export type { BadgeAnchor, InlineBadgeBase } from './badges/badge-envelope.types';
export type { BadgeKind, BadgeKindDescriptor } from './badges/badge-kind';
export {
  BADGE_KIND_COUNT,
  BADGE_KIND_DESCRIPTORS,
  BADGE_KINDS,
  describeBadgeKind,
  isBadgeKind,
} from './badges/badge-kind';

export type {
  City3dBadge,
  City3dBadgePayload,
  CityLandmark,
  JourneyDistance,
  RouteBadge,
  RouteBadgePayload,
} from './badges/spatial-badge.types';
export type {
  AudioOverview,
  ContextBadge,
  ContextBadgePayload,
  CulturalBadge,
  CulturalBadgePayload,
  CulturalWorld,
  HistoryBadge,
  HistoryBadgePayload,
  TimelineEvent,
} from './badges/historical-badge.types';
export type {
  CrossReferenceRelation,
  CrossReferenceTarget,
  CrossRefBadge,
  CrossRefBadgePayload,
  ManuscriptBadge,
  ManuscriptBadgePayload,
  ManuscriptWitness,
  OriginalLanguage,
  RootBadge,
  RootBadgePayload,
  TranslationReading,
} from './badges/textual-badge.types';
export type {
  LineageBadge,
  LineageBadgePayload,
  LineagePerson,
  LineageRelation,
  LineageRelationKind,
  MeditateBadge,
  MeditateBadgePayload,
  MessianicLink,
  StructuralNode,
  StructureBadge,
  StructureBadgePayload,
} from './badges/literary-badge.types';

/**
 * Any inline badge, discriminated by `kind`.
 *
 * Narrow with a `switch (badge.kind)` and close it with {@link assertBadgeHandled}; the
 * compiler then guarantees every sheet has a case.
 */
export type InlineBadge =
  | RouteBadge
  | City3dBadge
  | HistoryBadge
  | RootBadge
  | LineageBadge
  | ManuscriptBadge
  | CrossRefBadge
  | StructureBadge
  | CulturalBadge
  | ContextBadge
  | MeditateBadge;

/** The badge type belonging to one kind, e.g. `BadgeOfKind<'route'>` is `RouteBadge`. */
export type BadgeOfKind<TKind extends BadgeKind> = Extract<InlineBadge, { kind: TKind }>;

/** The sheet payload belonging to one kind, without naming the badge type. */
export type BadgePayloadOfKind<TKind extends BadgeKind> = BadgeOfKind<TKind>['payload'];

/**
 * Close an exhaustive `switch` over {@link InlineBadge}.
 *
 * Reaching this function means a badge kind was added to the union without a case being
 * added here — a programming error, not a runtime condition a reader can cause, so it
 * throws rather than returning a `Result` (rule 6.1.5: unrecoverable errors fail loudly).
 *
 * @param badge - The value TypeScript has narrowed to `never`.
 * @returns Never returns.
 * @throws Error - Always, naming the unhandled kind.
 */
export function assertBadgeHandled(badge: never): never {
  const kind = (badge as { readonly kind?: string }).kind ?? 'unknown';

  throw new Error(`Unhandled inline badge kind: ${kind}`);
}
