/**
 * Surface texture tokens.
 *
 * Purpose
 *   Decision `D-05`: *"No excessive glass stuff tho textures would be nice."* This module
 *   is the "textures" half — which motif each class of surface wears, in what ink, at what
 *   strength, in each theme. The glass half is the restraint applied elsewhere: blur is
 *   confined to transient overlays (port-map risk #7).
 *
 * What is here and what is next door
 *   This module is pure data: no asset imports, so it can be unit-tested under Node.
 *   The bundled PNGs live in `./texture-source.ts`, which cannot be — a `require` of a
 *   `.png` only resolves inside Metro.
 *
 * How the tiles exist
 *   Six seamless PNGs baked by `tools/textures/build-textures.mjs` from the Flutter
 *   prototype's six procedural motifs (`widgets/patterns.dart`). Each is white with a
 *   varying alpha and under 300 bytes, so the app tints one tile per theme rather than
 *   shipping two sets, and the whole texture system costs about a kilobyte of assets.
 *   Port-map risk #6 names exactly this trade: pre-baked tiles, repeated by the platform's
 *   image compositor, instead of a full-screen SVG `<Pattern>` re-rasterised on resize.
 *
 * The strengths are deliberately small
 *   A texture the reader can *see* is noise. These sit between 2 % and 5 % — enough that a
 *   flat panel stops looking like a flat panel, not enough to compete with scripture. The
 *   first pass ran at 4-6 % and, looked at in a browser, read as wallpaper rather than as a
 *   surface; the canvas in particular, which is the largest area and sits directly behind
 *   the text, is the quietest of the five. Light mode runs lower again, because dark ink on
 *   paper reads heavier than white ink on near-black at the same alpha.
 *
 * Dependencies
 *   `./color-math` and `./theme-contract` for types only. No React, no React Native.
 */

import type { HexColor } from './color-math';
import type { ThemeName } from './theme-contract';

/** The six baked motifs. */
export type TextureName = 'cross' | 'hatch' | 'grid' | 'dots' | 'waves' | 'rings';

/**
 * The class of surface a texture is being applied to.
 *
 * A role, not a motif: components ask for `'canvas'`, not for `'cross'`, so re-skinning
 * the app is a change to this file rather than to every screen.
 */
export type TextureRole = 'canvas' | 'rail' | 'panel' | 'card' | 'sheet';

/** Everything a component needs to paint one texture. */
export interface TextureToken {
  /** Which baked tile to repeat. */
  readonly name: TextureName;
  /** The colour the white tile is tinted to. */
  readonly tint: HexColor;
  /** How strongly it is painted, `0..1`. */
  readonly opacity: number;
}

/**
 * Which motif each surface class wears.
 *
 * Follows the prototype's own assignments (`patterns.dart`'s doc comment): the woven
 * cross-hatch on the reading canvas, a stipple on the nav rail, a fine grid on the context
 * panel, waves on sheets. Cards take the diagonal hatch, which is the quietest of the six
 * at small sizes.
 */
const TEXTURE_MOTIF = {
  canvas: 'cross',
  rail: 'dots',
  panel: 'grid',
  card: 'hatch',
  sheet: 'waves',
} as const satisfies Record<TextureRole, TextureName>;

/** The ink each theme tints the white tile to. */
const TEXTURE_INK = {
  dark: '#FFFFFF',
  light: '#161A21',
} as const satisfies Record<ThemeName, HexColor>;

/** How strongly each surface class is textured, per theme. */
const TEXTURE_STRENGTH = {
  dark: { canvas: 0.028, rail: 0.05, panel: 0.036, card: 0.03, sheet: 0.042 },
  light: { canvas: 0.022, rail: 0.04, panel: 0.028, card: 0.024, sheet: 0.034 },
} as const satisfies Record<ThemeName, Record<TextureRole, number>>;

/**
 * The texture for one surface class under one theme.
 *
 * @param role - Which class of surface is being painted.
 * @param themeName - The active theme.
 * @returns The tile, its tint, and its opacity.
 */
export function textureFor(role: TextureRole, themeName: ThemeName): TextureToken {
  return {
    name: TEXTURE_MOTIF[role],
    tint: TEXTURE_INK[themeName],
    opacity: TEXTURE_STRENGTH[themeName][role],
  };
}

/** Every role a texture is defined for. Exported so tests can iterate rather than restate. */
export const textureRoles = ['canvas', 'rail', 'panel', 'card', 'sheet'] as const;

/** Every baked motif. */
export const textureNames = ['cross', 'hatch', 'grid', 'dots', 'waves', 'rings'] as const;

/**
 * The ceiling a texture may be painted at.
 *
 * `D-05` asks for texture, not for pattern. Anything above this stops being a surface
 * quality and starts being decoration competing with scripture, so the test locks it.
 */
export const MAX_TEXTURE_OPACITY = 0.08;
