/**
 * Inline-badge geometry — the arithmetic that puts a pill on a line of scripture.
 *
 * Purpose
 *   React Native aligns an inline `<View>` inside a `<Text>` differently on native and on
 *   the web, and the difference is roughly half the pill's height. This module computes the
 *   pill's size from the surrounding scripture size and the per-platform nudge that makes
 *   the two agree. It is pure so the arithmetic is unit-tested rather than eyeballed.
 *
 * The measured platform difference (read from React Native 0.86.3's own source)
 *   - Android: `TextInlineViewPlaceholderSpan.getSize` sets `fm.ascent = -height` and
 *     `fm.descent = 0`, so the view's BOTTOM EDGE lands exactly on the text baseline.
 *   - iOS: `RCTAttributedTextUtils.mm` builds an `NSTextAttachment` whose `bounds.origin.y`
 *     is the inline view's frame origin (0), which likewise puts the bottom edge on the
 *     baseline.
 *   - Web: `react-native-web`'s `View` picks up `display: inline-flex` whenever it has a
 *     text ancestor. CSS then aligns the inline-flex box by ITS OWN baseline, which is the
 *     baseline of its first flex item — the label — not its bottom edge.
 *   So an uncorrected pill sits about 8 pt higher on native than on the web at the 20 pt
 *   reading size. {@link badgeBaselineOffset} closes that gap.
 *
 * Key responsibilities
 *   - `badgeGeometry` — the pill's height, padding, and label size for a scripture size.
 *   - `badgeBaselineOffset` — the per-platform vertical nudge, in points.
 *
 * Dependencies
 *   `@/theme` for the scripture size scale and the spacing/size tokens. No React, no React
 *   Native, so it runs under the plain-node Vitest project.
 */

import { scriptureSize, scriptureText, size, spacing, type ScriptureStep } from '@/theme';

/** The platforms whose baseline rules differ. `ios` and `android` behave identically. */
export type BadgePlatform = 'ios' | 'android' | 'web';

/**
 * Pill height as a multiple of the scripture size.
 *
 * `docs/product/design-language.md` §5 asks for 22-24 pt against §3's 19-21 pt reading
 * range. 1.15 maps that range onto exactly 22, 23, 24 — the design's band, derived rather
 * than hard-coded, so a reader text-size change keeps the proportion.
 */
const HEIGHT_RATIO = 1.15;

/** Label size as a multiple of the scripture size. 0.6 puts the 20 pt reading size at 12 pt. */
const LABEL_SIZE_RATIO = 0.6;

/** Label line-height as a multiple of the label size, matching `uiText`'s 1.4. */
const LABEL_LINE_HEIGHT_RATIO = 1.4;

/**
 * The label face's ascent as a multiple of its size.
 *
 * Measured, not assumed: `docs/architecture/spike-inline-badges.md` records the browser probe
 * that put the label's baseline 12.0 px below the top of a 12 pt label box with a 17 pt line
 * height, which these two ratios reproduce to within 0.02 px. That probe ran against the
 * face the browser SUBSTITUTES while `expo-font` loads nothing (see the "Font loading" note
 * in `@/theme/typography`), so both numbers are calibrated against the fallback. Re-measure
 * the moment Inter is actually registered (assumption `D-03`) — a different face moves them.
 */
const LABEL_ASCENT_RATIO = 0.9;

/**
 * The label face's ascent plus descent as a multiple of its size — its content box, which is
 * what the line height is distributed around as half-leading.
 */
const LABEL_CONTENT_RATIO = 1.22;

/**
 * How far below the scripture baseline the pill's bottom edge should sit, as a multiple of
 * the scripture size.
 *
 * Zero would hang the pill off the baseline like a capital letter, which reads as floating;
 * a serif's descenders drop about a quarter of its size, so matching them makes the pill sit
 * inside the same optical band as the text (§5, "must not disturb the line rhythm").
 */
const OVERHANG_RATIO = 0.22;

/**
 * Width of an inter-word gap as a multiple of the scripture size.
 *
 * Only the flex-wrap strategy needs this: once a verse is shattered into one view per word,
 * the spaces are gone and the layout has to put them back. A Latin serif's space glyph is
 * about a quarter of its em, and this being an approximation rather than the face's real
 * advance width is one of that strategy's costs.
 */
const WORD_GAP_RATIO = 0.25;

/** Everything a renderer needs to draw one pill at one scripture size, in points. */
export interface BadgeGeometry {
  /** Overall pill height. */
  readonly height: number;
  /** Space between the border and the label, left and right. */
  readonly paddingHorizontal: number;
  /** Space between the border and the label, top and bottom. */
  readonly paddingVertical: number;
  /** Label font size. */
  readonly labelFontSize: number;
  /** Label line-height. */
  readonly labelLineHeight: number;
  /** Corner radius. A true pill: half the height, so the ends are semicircles. */
  readonly borderRadius: number;
  /** Approximate width of a space, for the strategy that lays words out as flex children. */
  readonly wordGap: number;
}

/**
 * Computes the pill's dimensions for the scripture size it sits inside.
 *
 * @param step - The surrounding scripture size. Defaults to `md`, the 20 pt reading size.
 * @returns Rounded point values; every one is derived from a token, none is a literal.
 */
export function badgeGeometry(step: ScriptureStep = 'md'): BadgeGeometry {
  const height = Math.round(scriptureSize[step] * HEIGHT_RATIO);
  const labelFontSize = Math.round(scriptureSize[step] * LABEL_SIZE_RATIO);
  const labelLineHeight = Math.round(labelFontSize * LABEL_LINE_HEIGHT_RATIO);
  return {
    height,
    paddingHorizontal: spacing.sm,
    paddingVertical: Math.max(0, (height - labelLineHeight) / 2),
    labelFontSize,
    labelLineHeight,
    borderRadius: height / 2,
    wordGap: Math.round(scriptureSize[step] * WORD_GAP_RATIO),
  };
}

/**
 * How the host aligns the pill before any correction is applied.
 *
 * `textAttachment` — the pill is a child of a `<Text>`, so the platform's inline-attachment
 * rule decides. `flexBaseline` — the pill is a flex child of a row with
 * `alignItems: 'baseline'`, where both Yoga and CSS take the pill's own first-line baseline,
 * i.e. the label's, on every platform.
 */
export type BadgeAlignment = 'textAttachment' | 'flexBaseline';

/**
 * The vertical nudge that puts the pill's bottom edge the same distance below the baseline
 * everywhere, whichever alignment rule the host applied.
 *
 * Applied as a `translateY` transform, which moves the pill without touching the line box —
 * so correcting the alignment can never reflow the paragraph.
 *
 * @param alignment - How the host aligned the pill. See {@link BadgeAlignment}.
 * @param platform - Which platform is rendering.
 * @param step - The surrounding scripture size.
 * @returns Points to translate down by. Positive moves the pill down.
 */
export function badgeBaselineOffset(
  alignment: BadgeAlignment,
  platform: BadgePlatform,
  step: ScriptureStep = 'md',
): number {
  const overhang = scriptureSize[step] * OVERHANG_RATIO;
  if (alignment === 'textAttachment' && platform !== 'web') {
    // Native attaches the pill with its bottom edge exactly on the baseline; push it down.
    return round(overhang);
  }
  // Every other case starts with the LABEL's baseline on the text baseline, so the bottom
  // edge already hangs this far below it. Correct by the difference.
  return round(overhang - bottomEdgeBelowLabelBaseline(step));
}

/**
 * How far the pill's bottom edge falls below its own label's baseline.
 *
 * The label's baseline sits half a leading plus an ascent below the top of its line box, and
 * that box sits below the pill's top padding. Exported so a test can assert the rendered
 * result rather than restating this arithmetic.
 *
 * @param step - The surrounding scripture size.
 * @returns Points from the label's baseline down to the pill's bottom edge.
 */
export function bottomEdgeBelowLabelBaseline(step: ScriptureStep = 'md'): number {
  const geometry = badgeGeometry(step);
  const halfLeading = (geometry.labelLineHeight - geometry.labelFontSize * LABEL_CONTENT_RATIO) / 2;
  const baselineFromPillTop =
    geometry.paddingVertical + halfLeading + geometry.labelFontSize * LABEL_ASCENT_RATIO;
  return round(geometry.height - baselineFromPillTop);
}

/** Points, rounded to two decimals so two call sites with the same inputs compare equal. */
const OFFSET_DECIMALS = 2;

/**
 * @param value - A point value.
 * @returns The value rounded to {@link OFFSET_DECIMALS} decimals.
 */
function round(value: number): number {
  return Number(value.toFixed(OFFSET_DECIMALS));
}

/**
 * Whether a pill at this scripture size fits the shared control height.
 *
 * The badge is the smallest control in the app; if it ever grows past `size.control` the
 * design language's "one shared control height" claim (`spacing.ts`) has quietly broken.
 *
 * @param step - The surrounding scripture size.
 * @returns True when the pill is no taller than a standard control.
 */
export function fitsControlHeight(step: ScriptureStep = 'md'): boolean {
  return badgeGeometry(step).height <= size.control;
}

/**
 * A serif's descent as a multiple of its size — how far below the baseline the line box runs.
 */
const SCRIPTURE_DESCENT_RATIO = 0.25;

/**
 * Whether the pill fits inside the scripture's line box on Android.
 *
 * This is the invariant the badge design lives or dies by, and it comes straight out of
 * React Native 0.86.3's Android implementation:
 *   - `TextLayoutManager.kt:1303` positions an inline view at
 *     `layout.getLineBaseline(line) - placeholderHeight`, so the pill occupies the whole
 *     ascent side of the line box.
 *   - `CustomLineHeightSpan.chooseHeight` then forces the line to exactly the requested line
 *     height, in BOTH directions. It will not grow a line to fit a tall attachment.
 * A pill taller than `lineHeight - descent` therefore does not push the paragraph open — it
 * silently overlaps the line ABOVE it, which is the ugliest possible failure in a reading app
 * and would only show up on a wrapped verse.
 *
 * @param step - The surrounding scripture size.
 * @returns True when the pill sits entirely inside its own line box.
 */
export function fitsLineBox(step: ScriptureStep = 'md'): boolean {
  const descent = scriptureSize[step] * SCRIPTURE_DESCENT_RATIO;
  return badgeGeometry(step).height + descent <= scriptureText(step).lineHeight;
}
