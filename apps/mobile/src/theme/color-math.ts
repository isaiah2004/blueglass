/**
 * Colour value arithmetic.
 *
 * Purpose
 *   Gives the token layer the two colour operations it needs — describing a colour as a
 *   type the compiler can check, and deriving a translucent colour from an opaque one —
 *   without any component ever writing a colour by hand.
 *
 * Key responsibilities
 *   - Define `HexColor` / `RgbaColor` / `Color`, so a token slot cannot hold an arbitrary
 *     string (`'red'`, `'F0B429'`, `''` are all rejected by the compiler).
 *   - Parse a `Color` into channels, and composite a translucent colour over an opaque one.
 *   - Derive an alpha variant of a palette hue (`withAlpha`), which is how the inline
 *     badge's 10 % surface and 35 % border are built from its single hue.
 *
 * Dependencies
 *   None. Pure data and arithmetic — no React, no React Native, no platform APIs.
 *
 * Usage
 *   ```ts
 *   const badgeSurface = withAlpha('#35D2E8', 0.1); // 'rgba(53,210,232,0.1)'
 *   ```
 */

/**
 * An opaque colour written as `#RRGGBB`.
 *
 * The template literal stops the obvious mistakes (a bare name, a missing `#`); the
 * six-digit shape itself is enforced at runtime by {@link toRgbaChannels}, because a
 * fully precise hex template type expands to 16^6 union members and TypeScript refuses it.
 */
export type HexColor = `#${string}`;

/**
 * A translucent colour.
 *
 * Written without spaces, always — that is the only form the type can describe, and
 * keeping one canonical spelling means two equal colours are also equal strings.
 */
export type RgbaColor = `rgba(${number},${number},${number},${number})`;

/** Any colour a design token may hold. */
export type Color = HexColor | RgbaColor;

/** A colour split into its channels. Red, green and blue are 0–255; alpha is 0–1. */
export interface RgbaChannels {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/** Thrown when a string typed as a `Color` is not actually a colour this module can read. */
export class InvalidColorError extends Error {
  /**
   * @param color - The offending value, quoted into the message so the failing token is
   *   obvious without a debugger.
   */
  public constructor(color: string) {
    super(`Not a readable colour: "${color}". Expected "#RRGGBB" or "rgba(r,g,b,a)".`);
    this.name = 'InvalidColorError';
  }
}

/** Exactly `#` followed by six hexadecimal digits. */
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Channel count in an `rgba(...)` function: red, green, blue, alpha. */
const RGBA_CHANNEL_COUNT = 4;

/** Alpha is stored to two decimals so `withAlpha` output is stable and comparable. */
const ALPHA_DECIMALS = 2;

/** Largest value a single 8-bit colour channel can hold. */
const CHANNEL_MAXIMUM = 255;

/**
 * Splits a colour into numeric channels.
 *
 * @param color - A `#RRGGBB` or `rgba(r,g,b,a)` colour.
 * @returns The red, green and blue channels (0–255) and alpha (0–1).
 * @throws {InvalidColorError} If the string is neither form.
 */
export function toRgbaChannels(color: Color): RgbaChannels {
  if (HEX_COLOR_PATTERN.test(color)) {
    const packed = Number.parseInt(color.slice(1), 16);
    return {
      red: (packed >> 16) & CHANNEL_MAXIMUM,
      green: (packed >> 8) & CHANNEL_MAXIMUM,
      blue: packed & CHANNEL_MAXIMUM,
      alpha: 1,
    };
  }

  if (color.startsWith('rgba(') && color.endsWith(')')) {
    const parts = color.slice('rgba('.length, -1).split(',').map(Number);
    const isWellFormed =
      parts.length === RGBA_CHANNEL_COUNT && parts.every((part) => Number.isFinite(part));
    if (isWellFormed) {
      // Defaults satisfy `noUncheckedIndexedAccess`; the length check above makes them dead.
      const [red = 0, green = 0, blue = 0, alpha = 1] = parts;
      return { red, green, blue, alpha };
    }
  }

  throw new InvalidColorError(color);
}

/**
 * Derives a translucent colour from an opaque one.
 *
 * This is how every alpha-bearing token in the palette is built. Components must call it
 * only on a colour that is already a token — never on a literal, which would smuggle a raw
 * colour back into the codebase (CLAUDE.md, "no raw colour, size, or spacing value").
 *
 * @param color - The opaque source colour.
 * @param alpha - Opacity from 0 (invisible) to 1 (opaque).
 * @returns The same hue at the requested opacity.
 * @throws {InvalidColorError} If `color` is unreadable, or `alpha` is outside 0–1.
 */
export function withAlpha(color: HexColor, alpha: number): RgbaColor {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new InvalidColorError(`${color} @ alpha ${String(alpha)}`);
  }

  const { red, green, blue } = toRgbaChannels(color);
  const rounded = Number(alpha.toFixed(ALPHA_DECIMALS));
  return `rgba(${red},${green},${blue},${rounded})`;
}

/**
 * Composites a possibly translucent colour over an opaque background.
 *
 * Contrast is measured against what the eye actually sees, so a 10 %-opacity badge surface
 * has to be flattened onto the canvas before it can be audited.
 *
 * @param color - The colour drawn on top; may be translucent.
 * @param background - The opaque colour underneath.
 * @returns The resulting opaque colour.
 * @throws {InvalidColorError} If either argument is unreadable.
 */
/**
 * Re-alpha any colour, including one that already carries an alpha.
 *
 * {@link withAlpha} only accepts a hex value, which is right for building a palette from
 * raw hues. A component works from the *theme*, where a role is typed `Color` and may
 * already be translucent, so it needs the more forgiving form: this multiplies the
 * existing alpha rather than replacing it, so `withOpacity(theme.line.hairline, 0.5)`
 * halves a hairline instead of making it opaque.
 *
 * @param color The token to re-alpha. A token, never a literal.
 * @param alpha A multiplier in `0..1`.
 * @returns The same colour at `existing x alpha`.
 * @throws InvalidColorError when `alpha` is outside `0..1` or the colour is unreadable.
 */
export function withOpacity(color: Color, alpha: number): RgbaColor {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new InvalidColorError(`${color} @ alpha ${String(alpha)}`);
  }

  const { red, green, blue, alpha: existing } = toRgbaChannels(color);
  const rounded = Number((existing * alpha).toFixed(ALPHA_DECIMALS));
  return `rgba(${red},${green},${blue},${rounded})`;
}

export function flattenOver(color: Color, background: HexColor): HexColor {
  const top = toRgbaChannels(color);
  const under = toRgbaChannels(background);
  const blend = (over: number, beneath: number): number =>
    Math.round(over * top.alpha + beneath * (1 - top.alpha));

  const packed =
    (blend(top.red, under.red) << 16) |
    (blend(top.green, under.green) << 8) |
    blend(top.blue, under.blue);

  return `#${packed.toString(16).padStart(6, '0').toUpperCase()}`;
}
