/**
 * Alpha over any token colour.
 *
 * Purpose
 *   `@/theme`'s `withAlpha` takes a `HexColor`, which is right for building the palette:
 *   every alpha-bearing token there starts from an opaque hue. Components have a different
 *   problem. They read a role off `Theme`, whose fields are typed `Color` — the union of
 *   hex and rgba — because a theme is free to fill a role with either. Passing that to
 *   `withAlpha` is a type error even though the value is a token.
 *
 *   This is the missing half: alpha over anything the token layer can hold.
 *
 * WHERE THIS BELONGS
 *   `@/theme`'s `color-math`, beside `withAlpha`, which is the module that already owns
 *   channel arithmetic. It lives here only because that file is another agent's, and the
 *   move is a copy-paste plus one export.
 *
 * The rule it does not relax
 *   The argument must still be a token. Calling this on a literal smuggles a raw colour
 *   back into a component exactly as `withAlpha` would, and the type system cannot tell
 *   the difference — only review can.
 *
 * Dependencies
 *   `@/theme` for `toRgbaChannels` and the colour types. No React, no React Native.
 */

import { toRgbaChannels, type Color, type RgbaColor } from '@/theme';

/** Smallest and largest alpha a colour may carry. */
const ALPHA_RANGE = { min: 0, max: 1 } as const;

/**
 * The same colour at a different opacity.
 *
 * @param color - A colour token — hex or rgba. Never a literal.
 * @param alpha - Opacity from 0 to 1. Values outside the range are clamped rather than
 *   thrown on: a clamped colour still renders, and a reader should never lose a chapter to
 *   an arithmetic slip in a style.
 * @returns The token's hue at the requested opacity. Side effects: none.
 */
export function tint(color: Color, alpha: number): RgbaColor {
  const channels = toRgbaChannels(color);
  const clamped = Math.min(ALPHA_RANGE.max, Math.max(ALPHA_RANGE.min, alpha));
  return `rgba(${String(channels.red)},${String(channels.green)},${String(channels.blue)},${String(clamped)})` as RgbaColor;
}

/**
 * The transparent form of a colour: that colour at zero alpha.
 *
 * The reason this exists rather than `tint(color, 0)` at call sites is documentation. The
 * prototype shipped a bug here and fixed it deliberately — fading a warm paper fill towards
 * the string `'transparent'` travels through transparent *black*, which reads as a grey
 * flash. Fading towards the paper's own colour at zero alpha does not. Naming the idea is
 * what stops it being un-fixed by someone who thinks `'transparent'` is simpler.
 *
 * @param color - The surface being faded from or to — normally the reading canvas.
 * @returns That colour, invisible. Side effects: none.
 */
export function clearOn(color: Color): RgbaColor {
  return tint(color, 0);
}
