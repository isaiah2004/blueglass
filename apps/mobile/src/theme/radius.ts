/**
 * Shape tokens — corner radii and border widths.
 *
 * Purpose
 *   `docs/product/design-language.md` §4 fixes three radius bands: 14-16 on cards and
 *   sheets, 10-11 on controls, 999 on pills. Naming them by the thing they belong to, rather
 *   than by `sm`/`md`/`lg`, is what stops a card from quietly acquiring a control's radius.
 *
 * Key responsibilities
 *   - `radius` — the corner scale, keyed by surface role.
 *   - `borderWidth` — the two stroke weights. Cards carry a 1 px hairline and never a drop
 *     shadow (§4); the inline badge carries a 1 px border in its own hue (§5).
 *
 * Dependencies
 *   None. Pure data — no React, no React Native.
 *
 * Usage
 *   ```ts
 *   const styles = StyleSheet.create({
 *     card: { borderRadius: radius.card, borderWidth: borderWidth.hairline },
 *   });
 *   ```
 */

/** Corner radii, in density-independent pixels, keyed by the surface they belong to. */
export const radius = {
  /** 0 — a deliberately square corner, so "no radius" is still a token. */
  none: 0,
  /** 11 — buttons, chips, segmented controls, input fields (§4's 10-11 band). */
  control: 11,
  /** 14 — cards (§4's 14-16 band, lower end: cards are smaller than sheets). */
  card: 14,
  /** 16 — bottom sheets and any full-width elevated surface (§4's 14-16 band, upper end). */
  sheet: 16,
  /** 999 — pills: the inline badge, source chips, the streak counter. */
  pill: 999,
} as const;

/** A named corner radius. */
export type RadiusStep = keyof typeof radius;

/** Stroke weights, in density-independent pixels. */
export const borderWidth = {
  /** 0 — no stroke. */
  none: 0,
  /**
   * 1 — every border in the design language. Deliberately not `StyleSheet.hairlineWidth`:
   * that would be a React Native import, and a sub-pixel border disappears on the
   * near-black canvas where the hairline is already only 8 % white.
   */
  hairline: 1,
  /** 2 — a focus ring or a selected state, where the stroke must survive at a glance. */
  focus: 2,
} as const;

/** A named stroke weight. */
export type BorderWidthStep = keyof typeof borderWidth;
