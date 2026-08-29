/**
 * WCAG 2.2 contrast measurement.
 *
 * Purpose
 *   The palette is near-black with two saturated accents, which is exactly the situation
 *   where a good-looking pair quietly fails legibility. Question `D-06`'s standing default
 *   is "AA for text contrast", so the token layer ships the measurement itself and the
 *   audit test locks every key pair to a number.
 *
 * Key responsibilities
 *   - Relative luminance and contrast ratio, per WCAG 2.2 §1.4.3 / §1.4.11.
 *   - The four thresholds worth naming, as a union rather than loose numbers.
 *   - `meetsContrast`, so a test or a QA screen can assert a pair rather than eyeball it.
 *
 * Dependencies
 *   `./color-math` only. No React, no React Native.
 *
 * Usage
 *   ```ts
 *   meetsContrast(colors.ink.primary, colors.background.canvas, 'aaText'); // true
 *   ```
 */

import { flattenOver, toRgbaChannels, type Color, type HexColor } from './color-math';

/**
 * The contrast bars this project cares about.
 *
 * - `aaText` — normal-size body text (WCAG 1.4.3). The bar `D-06` sets.
 * - `aaLarge` — text at or above 18.66 pt regular / 14 pt bold (WCAG 1.4.3).
 * - `aaaText` — the enhanced bar (WCAG 1.4.6). Aspirational here, not required.
 * - `nonText` — icons, focus rings, and any border that carries meaning (WCAG 1.4.11).
 */
export type ContrastLevel = 'aaText' | 'aaLarge' | 'aaaText' | 'nonText';

/** Minimum ratio each level demands. */
export const CONTRAST_MINIMUM: Readonly<Record<ContrastLevel, number>> = {
  aaText: 4.5,
  aaLarge: 3,
  aaaText: 7,
  nonText: 3,
};

/** sRGB channel value below which the transfer function is linear rather than a power curve. */
const SRGB_LINEAR_THRESHOLD = 0.03928;

/** Divisor for the linear segment of the sRGB transfer function. */
const SRGB_LINEAR_DIVISOR = 12.92;

/** Offset applied before the power segment of the sRGB transfer function. */
const SRGB_GAMMA_OFFSET = 0.055;

/** Exponent of the power segment of the sRGB transfer function. */
const SRGB_GAMMA_EXPONENT = 2.4;

/** Per-channel weights of the CIE luminance sum used by WCAG. */
const LUMINANCE_WEIGHT = { red: 0.2126, green: 0.7152, blue: 0.0722 } as const;

/** Constant added to both luminances so a pure-black pair cannot divide by zero. */
const LUMINANCE_FLARE = 0.05;

/** Largest value a single 8-bit colour channel can hold. */
const CHANNEL_MAXIMUM = 255;

/**
 * Converts one gamma-encoded sRGB channel to its linear-light value.
 *
 * @param channel - Channel value in 0–255.
 * @returns The linearised channel in 0–1.
 */
function linearise(channel: number): number {
  const normalised = channel / CHANNEL_MAXIMUM;
  return normalised <= SRGB_LINEAR_THRESHOLD
    ? normalised / SRGB_LINEAR_DIVISOR
    : Math.pow((normalised + SRGB_GAMMA_OFFSET) / (1 + SRGB_GAMMA_OFFSET), SRGB_GAMMA_EXPONENT);
}

/**
 * Relative luminance of an opaque colour, per WCAG 2.2.
 *
 * @param color - An opaque colour. Flatten translucent colours first with `flattenOver`.
 * @returns Luminance in 0 (black) to 1 (white).
 * @throws {InvalidColorError} If the colour cannot be read.
 */
export function relativeLuminance(color: HexColor): number {
  const { red, green, blue } = toRgbaChannels(color);
  return (
    LUMINANCE_WEIGHT.red * linearise(red) +
    LUMINANCE_WEIGHT.green * linearise(green) +
    LUMINANCE_WEIGHT.blue * linearise(blue)
  );
}

/**
 * Contrast ratio between two colours.
 *
 * A translucent foreground is composited over the background first, which is what makes
 * the inline badge — a hue at 10 % over near-black — auditable at all.
 *
 * @param foreground - Text, icon, or border colour. May be translucent.
 * @param background - The opaque surface behind it.
 * @returns A ratio from 1 (identical) to 21 (black on white).
 * @throws {InvalidColorError} If either colour cannot be read.
 */
export function contrastRatio(foreground: Color, background: HexColor): number {
  const foregroundLuminance = relativeLuminance(flattenOver(foreground, background));
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + LUMINANCE_FLARE) / (darker + LUMINANCE_FLARE);
}

/**
 * Whether a foreground/background pair clears a given WCAG bar.
 *
 * @param foreground - Text, icon, or border colour. May be translucent.
 * @param background - The opaque surface behind it.
 * @param level - Which bar to test against.
 * @returns `true` when the measured ratio meets or exceeds the level's minimum.
 * @throws {InvalidColorError} If either colour cannot be read.
 */
export function meetsContrast(
  foreground: Color,
  background: HexColor,
  level: ContrastLevel,
): boolean {
  return contrastRatio(foreground, background) >= CONTRAST_MINIMUM[level];
}
