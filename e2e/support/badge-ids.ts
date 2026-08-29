/**
 * The test-id contract for milestone M2 — the inline badge system.
 *
 * Purpose
 *   `test-ids.ts` is the agreed vocabulary for the reading canvas M1 shipped. M2 adds a
 *   second, larger surface: pills inside the verse, a sheet or rail panel per badge, five
 *   distinct sheet bodies, and a chapter-end summary. Those ids live here rather than
 *   swelling the M1 contract past the point where anyone reads it, and because a badge id
 *   is not a shell id — a chapter that only cares about badges imports only this.
 *
 * The same rule applies: **the app names things, the harness follows.**
 *   Every string below is one a component already renders. Where a body id exists but
 *   nothing in the reader mounts the component that carries it, that is recorded on the
 *   entry — the harness is how a gap like that gets reported, not something it should
 *   paper over by asserting a weaker thing.
 *
 * Dependencies
 *   None. Pure data.
 */

/** The five badge kinds `P-04` commits to, spelled as the API and the DOM spell them. */
export const BADGE_KINDS = ['route', '3d-city', 'history', 'root', 'cross-ref'] as const;

/** One of the five kinds. */
export type BadgeKindName = (typeof BADGE_KINDS)[number];

/** The prefix every inline pill's test id starts with — `VerseText` renders it. */
export const INLINE_BADGE_PREFIX = 'inline-badge-';

/**
 * The id of one inline pill.
 *
 * @param badgeId The server's badge id, e.g. `route~44016001~chapter:Acts.16`.
 * @returns The test id `VerseText` puts on that pill.
 */
export function inlineBadgeId(badgeId: string): string {
  return `${INLINE_BADGE_PREFIX}${badgeId}`;
}

/** The two homes of one opened badge, and the chrome they share. */
export const BADGE_SURFACE_IDS = {
  /** The phone bottom sheet. Below 600 dp only — above it the rail is used instead. */
  sheet: 'badge-sheet',
  /** The rail panel, at and above 600 dp. `ContextPanel` renders it. */
  rail: 'reader-context-badge',
  /** The rail's close control. The sheet closes through its scrim instead. */
  railClose: 'badge-rail-close',
  /** The one-line claim, shared by both homes. */
  teaser: 'badge-detail-teaser',
} as const;

/**
 * The id of one badge's detail body, in whichever home it opened.
 *
 * @param badgeId The server's badge id.
 * @returns The test id `BadgeDetail` renders.
 */
export function badgeDetailId(badgeId: string): string {
  return `badge-detail-${badgeId}`;
}

/**
 * The id of the attribution strip beneath one badge.
 *
 * `AI-05`: a badge with no provenance must not render, so this is asserted for every kind
 * rather than sampled.
 *
 * @param badgeId The server's badge id.
 * @returns The test id `BadgeAttribution` renders.
 */
export function badgeSourcesId(badgeId: string): string {
  return `badge-sources-${badgeId}`;
}

/** The chapter-end summary list — `design-language.md` §5, second half. */
export const BADGE_SUMMARY_IDS = {
  root: 'chapter-badge-summary',
  /** The union of every source the chapter's badges rest on, printed once. */
  sources: 'chapter-badge-sources',
} as const;

/**
 * The id of one row in the chapter-end summary.
 *
 * @param badgeId The server's badge id.
 * @returns The test id `BadgeSummaryRow` renders.
 */
export function badgeSummaryRowId(badgeId: string): string {
  return `badge-summary-row-${badgeId}`;
}

/**
 * The body each of the five sheets should draw below the shared chrome.
 *
 * These ids are carried by real components in `apps/mobile/src/features/sheets/`, but the
 * reader reaches them only if something mounts `BadgeSheetProvider` with a renderer per
 * kind. Nothing does, so chapter 12 asserts these and reports the gap by name. Weakening
 * the assertion to "the chrome is present" would turn the headline M2 defect into a pass.
 */
export const BADGE_BODY_IDS: Readonly<Record<BadgeKindName, string>> = {
  route: 'spatial-route-map',
  '3d-city': 'spatial-city-map',
  history: 'history-axes',
  root: 'root-lemma',
  'cross-ref': 'cross-ref-targets',
} as const;

/**
 * The one detail each kind's body must show for the sheet to be worth opening.
 *
 * Used to say *why* a missing body matters in the failure message: not "an element is
 * absent" but "the reader tapped Route and was shown no map".
 */
export const BADGE_BODY_PROMISE: Readonly<Record<BadgeKindName, string>> = {
  route: 'the drawn route map (M-01: GeoJSON, no tile provider)',
  '3d-city': 'the city site map',
  history: 'the dual-axis timeline',
  root: 'the Greek or Hebrew lemma and its lexicon entry',
  'cross-ref': 'the list of linked passages',
} as const;

/** `Q-015`: Murai's literary structure ships attributed inline as "Murai's reading". */
export const MURAI_ATTRIBUTION = "Murai's reading";
