/**
 * Inline-badge types and the kind -> glyph/label table.
 *
 * Purpose
 *   One shared vocabulary for every inline-badge implementation in the spike, so the four
 *   competing render strategies differ only in *how* they draw, never in *what* they draw.
 *
 * Key responsibilities
 *   - Name the props every badge implementation accepts.
 *   - Hold the kind -> default-label table, keyed by the theme's `BadgeKind` so a new badge
 *     type is a compile error until it is given one.
 *   - Compose the bracketed mark. `docs/product/design-language.md` §5 makes the brackets
 *     part of the mark, not decoration, so exactly one function builds them.
 *
 * The glyph is not here, and that is the point
 *   The spike shipped colour emoji and recorded it as its first concession: §5 asks for "text
 *   and icon in the full hue", and an emoji is painted by the OS in its own palette. `Q-021`
 *   settles it - the glyph is now a vector path drawn by `./BadgeGlyph`, so the mark this
 *   module composes is *text only*: `[Route]`. A renderer places the glyph between the
 *   opening bracket and the word.
 *
 * Dependencies
 *   `@/theme` for `BadgeKind` only. No React, no React Native — this module is unit-testable
 *   under the plain-node Vitest project.
 */

import type { GestureResponderEvent } from 'react-native';

import type { BadgeKind, ScriptureStep } from '@/theme';

import type { BadgeAlignment } from './InlineBadge.geometry';

/**
 * The label shown inside the pill when the caller does not override it.
 *
 * `city3d` reads **Site**, not "3D City" (`Q-025`). `DECISIONS.md` §4 records it as one of
 * the two genuinely dataset-less badges: no openly licensed 3D reconstruction of a biblical
 * city exists, and the nearest candidate is CC BY-NC-ND, which fails twice over. So the
 * sheet behind the mark shows the gazetteer record and says so, its own eyebrow already
 * reads `SITE`, and the mark now promises what the sheet delivers. The wire kind stays
 * `3d-city` and the theme key stays `city3d`: neither is reader-facing, and renaming a
 * published discriminator to fix a label would be a breaking change for a cosmetic gain.
 */
export const badgeLabel = {
  route: 'Route',
  city3d: 'Site',
  history: 'History',
  manuscript: 'Manuscript',
  crossRef: 'Cross-Ref',
  root: 'Root',
  structure: 'Structure',
  cultural: 'Cultural',
  context: 'Context',
  meditate: 'Meditate',
  lineage: 'Lineage',
} as const satisfies Record<BadgeKind, string>;

/** Opening bracket of the mark (`design-language.md` §5). */
const MARK_OPEN = '[';

/** Closing bracket of the mark. */
const MARK_CLOSE = ']';

/**
 * Builds the text of one badge's mark, brackets included.
 *
 * Kept separate from rendering because two of the four strategies draw the mark as a single
 * string and two draw it as three nodes; both must produce identical characters.
 *
 * @param kind - Which badge type.
 * @param label - Overrides the default label for this kind.
 * @returns The full mark, e.g. `[<glyph> Route]`.
 */
export function composeBadgeMark(kind: BadgeKind, label?: string): string {
  return `${MARK_OPEN}${label ?? badgeLabel[kind]}${MARK_CLOSE}`;
}

/**
 * The three parts of a mark, for implementations that draw the glyph in its own node.
 *
 * The glyph belongs between the lead and the word, which is why they are separate: `[` and
 * `Route]` are two text nodes with a vector between them, and the brackets stay part of the
 * mark rather than becoming decoration around it.
 *
 * @param kind - Which badge type.
 * @param label - Overrides the default label for this kind.
 * @returns The opening bracket, the word, and the closing bracket.
 */
export function splitBadgeMark(
  kind: BadgeKind,
  label?: string,
): { readonly lead: string; readonly word: string; readonly tail: string } {
  return {
    lead: MARK_OPEN,
    word: label ?? badgeLabel[kind],
    tail: MARK_CLOSE,
  };
}

/** Inputs every inline-badge implementation accepts. */
export interface InlineBadgeProps {
  /** Which badge type. Decides the hue and the default glyph and label. */
  readonly kind: BadgeKind;
  /** Overrides the default label. */
  readonly label?: string;
  /**
   * The scripture size the badge is sitting inside. The pill scales with the surrounding
   * text so the line rhythm survives a reader text-size change (§5).
   */
  readonly scriptureStep?: ScriptureStep;
  /**
   * How the host is aligning the pill. Defaults to `textAttachment` — a child of a `<Text>`.
   * Pass `flexBaseline` when the badge is a flex child of a `alignItems: 'baseline'` row,
   * because the two hosts start the pill at different heights.
   */
  readonly alignment?: BadgeAlignment;
  /**
   * Opens the badge's sheet. Absent means the badge is decorative in this render.
   *
   * The event is forwarded because an inline badge always sits inside a larger control — the
   * verse row is itself pressable — and the handler must be able to stop the press bubbling
   * up to it. Tapping a pill must open the badge, not also select the verse underneath.
   */
  readonly onPress?: (event: GestureResponderEvent) => void;
  /** Test hook. */
  readonly testID?: string;
}
