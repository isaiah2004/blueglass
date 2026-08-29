/**
 * Spacing and sizing tokens.
 *
 * Purpose
 *   A single 4-point rhythm for padding, margins, and gaps, plus the handful of fixed
 *   element sizes the design language pins down. Components reference these names; they
 *   never inline a number (CLAUDE.md, "Where this project overrides ControlSight").
 *
 * Key responsibilities
 *   - `spacing` — the 4-point scale. If a layout needs a value that is not on the scale,
 *     the layout is wrong, not the scale.
 *   - `size` — element dimensions that must agree across unrelated components. One shared
 *     `control` height is why a header pill, a segmented tab, and a filter chip line up;
 *     the Flutter prototype proved that trick worth copying (`flutter-port-map.md` §6).
 *
 * Dependencies
 *   None. Pure data — no React, no React Native.
 *
 * Usage
 *   ```ts
 *   const styles = StyleSheet.create({ card: { padding: spacing.lg, gap: spacing.md } });
 *   ```
 */

/** The rhythm every spacing token is a multiple of, in density-independent pixels. */
const BASE_UNIT = 4;

/** Named steps on the 4-point spacing scale. */
export const spacing = {
  /** 0 — an explicit "no gap", so a reset is still a token. */
  none: 0,
  /** 4 — hairline gaps between tightly related elements. */
  xs: BASE_UNIT,
  /** 8 — inside a pill or chip. */
  sm: BASE_UNIT * 2,
  /** 12 — between stacked list rows. */
  md: BASE_UNIT * 3,
  /** 16 — default screen gutter and card padding. */
  lg: BASE_UNIT * 4,
  /** 24 — between sections. */
  xl: BASE_UNIT * 6,
  /** 32 — around a screen's primary content block. */
  xxl: BASE_UNIT * 8,
  /** 48 — above and below a hero, and the breathing room around an empty state. */
  xxxl: BASE_UNIT * 12,
} as const;

/** A named step on the spacing scale. */
export type SpacingStep = keyof typeof spacing;

/** Fixed element dimensions, in density-independent pixels. */
export const size = {
  /**
   * 32 — the one height shared by every small control: header pills, segmented tabs, chips,
   * and the sheet's sub-nav. Unrelated control groups line up only because they all use this.
   */
  control: 32,
  /** 24 — the inline badge's height (`design-language.md` §5 gives 22-24). */
  badge: 24,
  /**
   * 44 — the minimum touchable area. WCAG 2.2 §2.5.8 asks 24 and Apple's HIG asks 44; the
   * larger wins, and a control shorter than this pads its hit area up to it.
   */
  tapTarget: 44,
  /** The scripture gutter that holds the superscript verse number (§3). */
  verseNumberGutter: 28,
  /** Icon sizes. `md` is the default; `lg` is the active tab's glyph. */
  icon: { sm: 16, md: 20, lg: 24 },
  /** The grab handle at the top of every sheet (§4). */
  grabHandle: { width: 36, height: 4 },
} as const;
