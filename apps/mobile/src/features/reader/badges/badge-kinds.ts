/**
 * The one place a badge's wire kind meets the theme's.
 *
 * Purpose
 *   Two vocabularies exist for one concept and both are load-bearing. The **wire** spells the
 *   kinds `3d-city` and `cross-ref`, and so do `@atlas/shared` and the five sheet bodies, so
 *   that is what a badge record carries. The **theme** spells them `city3d` and `crossRef`,
 *   and that spelling is the key into the hue table, the glyph table and the pill's default
 *   label. Exactly one function translates, and its table is exhaustive by construction.
 *
 * Why the reader does not simply pick one
 *   Because neither side is wrong and both are published. `Q-018` is the queued question that
 *   collapses them; until it lands, a single tested mapping costs one lookup and removes the
 *   whole class of bug where a badge renders in another badge's colour.
 *
 * Dependencies
 *   `@/theme` for `BadgeKind`, and this folder's models. Data plus one lookup.
 */

import type { BadgeKind } from '@/theme';

import type { ReaderBadge, ReaderBadgeKind } from './badge-models';

/**
 * Wire spelling to theme spelling.
 *
 * `satisfies Record<ReaderBadgeKind, BadgeKind>` makes a sixth badge kind a compile error
 * here until it is given a hue, rather than a colourless pill in the middle of scripture.
 */
const WIRE_TO_THEME = {
  route: 'route',
  '3d-city': 'city3d',
  history: 'history',
  root: 'root',
  'cross-ref': 'crossRef',
} as const satisfies Record<ReaderBadgeKind, BadgeKind>;

/** The theme spelling of the five kinds M2 ships, in `P-04`'s listing order. */
export const SHIPPED_BADGE_KINDS: readonly BadgeKind[] = [
  'route',
  'city3d',
  'history',
  'root',
  'crossRef',
];

/**
 * The theme kind that decides a badge's hue, glyph and label.
 *
 * @param kind - The badge's wire kind.
 * @returns The theme's spelling. Total — every kind in the union has an entry.
 *   Side effects: none.
 */
export function themeBadgeKind(kind: ReaderBadgeKind): BadgeKind {
  return WIRE_TO_THEME[kind];
}

/**
 * The theme kind for a whole badge, so a component need not reach into `kind` itself.
 *
 * @param badge - The badge.
 * @returns The theme's spelling. Side effects: none.
 */
export function badgeHueKind(badge: ReaderBadge): BadgeKind {
  return themeBadgeKind(badge.kind);
}
