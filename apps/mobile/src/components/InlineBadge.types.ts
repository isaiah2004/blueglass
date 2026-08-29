/**
 * Inline-badge types and the kind -> glyph/label table.
 *
 * Purpose
 *   One shared vocabulary for every inline-badge implementation in the spike, so the four
 *   competing render strategies differ only in *how* they draw, never in *what* they draw.
 *
 * Key responsibilities
 *   - Name the props every badge implementation accepts.
 *   - Hold the ten kind -> glyph and kind -> default-label tables, keyed by the theme's
 *     `BadgeKind` so a new badge type is a compile error until it is given both.
 *   - Compose the bracketed mark. `docs/product/design-language.md` §5 makes the brackets
 *     part of the mark, not decoration, so exactly one function builds them.
 *
 * Known conflict with the design language
 *   §5 requires "text and icon in the full hue". The glyphs below are colour emoji, which
 *   the platform renders in its own palette and which `color` cannot tint. They are a
 *   stopgap for the spike only; question `Q-021` asks which monochrome icon set replaces
 *   them. See `docs/architecture/spike-inline-badges.md`.
 *
 * Dependencies
 *   `@/theme` for `BadgeKind` only. No React, no React Native — this module is unit-testable
 *   under the plain-node Vitest project.
 */

import type { BadgeKind, ScriptureStep } from '@/theme';

import type { BadgeAlignment } from './InlineBadge.geometry';

/**
 * Placeholder glyphs, one per badge kind, written as code points so the source file stays
 * pure ASCII and cannot be corrupted by an editor's encoding.
 */
export const badgeGlyph = {
  /** U+1F5FA world map. */
  route: '\u{1F5FA}',
  /** U+1F3DB classical building. */
  city3d: '\u{1F3DB}',
  /** U+23F3 hourglass with flowing sand. */
  history: '\u{23F3}',
  /** U+1F4DC scroll. */
  manuscript: '\u{1F4DC}',
  /** U+1F3AF direct hit. */
  crossRef: '\u{1F3AF}',
  /** U+1F331 seedling — a word's root. */
  root: '\u{1F331}',
  /** U+1F333 deciduous tree — the literary structure graph. */
  structure: '\u{1F333}',
  /** U+2696 balance scale. */
  cultural: '\u{2696}',
  /** U+1F399 studio microphone. */
  context: '\u{1F399}',
  /** U+1F9D8 person in lotus position. */
  meditate: '\u{1F9D8}',
} as const satisfies Record<BadgeKind, string>;

/** The label shown inside the pill when the caller does not override it. */
export const badgeLabel = {
  route: 'Route',
  city3d: '3D City',
  history: 'History',
  manuscript: 'Manuscript',
  crossRef: 'Cross-Ref',
  root: 'Root',
  structure: 'Structure',
  cultural: 'Cultural',
  context: 'Context',
  meditate: 'Meditate',
} as const satisfies Record<BadgeKind, string>;

/** Opening bracket of the mark (`design-language.md` §5). */
const MARK_OPEN = '[';

/** Closing bracket of the mark. */
const MARK_CLOSE = ']';

/** Separator between the glyph and the word, inside the brackets. */
const MARK_GAP = ' ';

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
  return `${MARK_OPEN}${badgeGlyph[kind]}${MARK_GAP}${label ?? badgeLabel[kind]}${MARK_CLOSE}`;
}

/**
 * The three parts of a mark, for implementations that render the glyph in its own node.
 *
 * @param kind - Which badge type.
 * @param label - Overrides the default label for this kind.
 * @returns The leading bracket-plus-glyph, the word, and the trailing bracket.
 */
export function splitBadgeMark(
  kind: BadgeKind,
  label?: string,
): { readonly lead: string; readonly word: string; readonly tail: string } {
  return {
    lead: `${MARK_OPEN}${badgeGlyph[kind]}`,
    word: `${MARK_GAP}${label ?? badgeLabel[kind]}`,
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
  /** Opens the badge's sheet. Absent means the badge is decorative in this render. */
  readonly onPress?: () => void;
  /** Test hook. */
  readonly testID?: string;
}
