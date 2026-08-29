/**
 * Typography tokens.
 *
 * Purpose
 *   Three families, strictly separated by role (`docs/product/design-language.md` §3):
 *   a classical serif for scripture, a neutral sans for the UI, a monospace for metadata.
 *   Nothing else may set a font. "Scripture is always the serif" is non-negotiable (§8.4),
 *   so the serif is reachable only through `scriptureText`.
 *
 * Key responsibilities
 *   - Name the registered font families, one per family-and-weight pair.
 *   - Hold the size scale for each family as a closed union of named steps.
 *   - Provide the three style factories, which compute line-height and letter-spacing from
 *     the family's ratios so no call site does that arithmetic.
 *
 * Line-height and tracking units
 *   React Native measures both in points, not multiples. The factories therefore take the
 *   design ratios (1.6 for scripture, §3) and resolve them against the chosen size.
 *
 * Font loading — NOT DONE YET, and it is not cosmetic
 *   The families below are the names `expo-font` must register (assumption `D-03`:
 *   Source Serif 4 / Inter / JetBrains Mono, all SIL OFL). Nothing loads them today: no
 *   `.ttf` is bundled under `apps/mobile/assets/`, `app.json`'s `expo-font` plugin carries
 *   no `fonts` array, and no `useFonts` call exists. Every platform therefore substitutes a
 *   system face — on the web build that is `system-ui, Segoe UI, Roboto`.
 *
 *   The tokens in THIS module are unaffected, because every size, line height and tracking
 *   value here is arithmetic over a declared size rather than a query against a face. What
 *   is affected is anything derived from a face's own metrics. `InlineBadge.geometry.ts`
 *   is exactly that: its `LABEL_ASCENT_RATIO` and `LABEL_CONTENT_RATIO` come from a browser
 *   probe of the *substituted* face, so the badge's baseline nudge will shift the moment
 *   Inter actually loads and must be re-measured then. Treat the badge spike's current
 *   numbers as calibrated against the fallback, not against Inter.
 *
 * Dependencies
 *   None. Pure data — no React, no React Native.
 *
 * Usage
 *   ```ts
 *   const styles = StyleSheet.create({ verse: scriptureText('md') });
 *   ```
 */

/** The weights any family may resolve to, as React Native spells them. */
export type FontWeightValue = '400' | '500' | '600' | '700';

/**
 * A text style, in the shape React Native's `TextStyle` expects.
 *
 * Declared locally rather than imported so this module stays free of framework imports;
 * it is structurally assignable to `TextStyle`.
 */
export interface TextStyleToken {
  /** The registered font family for this family-and-weight pair. */
  readonly fontFamily: string;
  /** Size in points. */
  readonly fontSize: number;
  /** Numeric weight as React Native spells it, kept for the web and system fallbacks. */
  readonly fontWeight: FontWeightValue;
  /** Resolved line-height in points, never a multiplier. */
  readonly lineHeight: number;
  /** Resolved tracking in points, never an em value. */
  readonly letterSpacing: number;
}

/** A metadata style. Always uppercase — that is what makes it read as metadata (§3). */
export interface MetadataStyleToken extends TextStyleToken {
  readonly textTransform: 'uppercase';
}

/** Weights the scripture serif ships. Body text is regular; emphasis is semi-bold. */
export type ScriptureWeight = 'regular' | 'semiBold';

/** Weights the UI sans ships. */
export type UiWeight = 'regular' | 'medium' | 'semiBold' | 'bold';

/** Weights the metadata mono ships. Uppercase tracked labels need optical weight, so no 400. */
export type MetadataWeight = 'medium' | 'bold';

/**
 * Registered family names, one per family-and-weight pair.
 *
 * React Native does not synthesise weights: each weight is its own registered face, and the
 * style must name it exactly. Setting `fontWeight` alone would silently render regular.
 */
export const fontFamily = {
  scripture: {
    regular: 'SourceSerif4-Regular',
    semiBold: 'SourceSerif4-SemiBold',
  },
  ui: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  metadata: {
    medium: 'JetBrainsMono-Medium',
    bold: 'JetBrainsMono-Bold',
  },
} as const;

/** Numeric weight for each named weight. */
const WEIGHT_VALUE = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const satisfies Record<string, FontWeightValue>;

/**
 * Scripture sizes in points.
 *
 * `sm`/`md`/`lg` are the 19-21 pt reading range §3 fixes, and are what a future reader
 * text-size preference switches between. `title` and `display` are the serif's
 * non-scripture uses: a chapter heading and the ATLAS BIBLE lockup.
 */
export const scriptureSize = { sm: 19, md: 20, lg: 21, title: 26, display: 32 } as const;

/** UI sans sizes in points, from a caption to a screen title. */
export const uiSize = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24 } as const;

/** Metadata sizes in points. §3 caps this family at 9-11 pt. */
export const metadataSize = { xs: 9, sm: 10, md: 11 } as const;

/** A named step on the scripture scale. */
export type ScriptureStep = keyof typeof scriptureSize;

/** A named step on the UI scale. */
export type UiStep = keyof typeof uiSize;

/** A named step on the metadata scale. */
export type MetadataStep = keyof typeof metadataSize;

/** Line-height as a multiple of size, per family. §3 fixes scripture's generous 1.6. */
const LINE_HEIGHT_RATIO = { scripture: 1.6, ui: 1.4, metadata: 1.3 } as const;

/**
 * Tracking as a multiple of size.
 *
 * Only metadata is tracked: §3 asks for .14em-.18em on the uppercase labels, and 0.16 is
 * the middle of that range. Scripture and UI text are never tracked.
 */
const LETTER_SPACING_RATIO = { scripture: 0, ui: 0, metadata: 0.16 } as const;

/** Tracking is rounded to this many decimals so styles compare equal across call sites. */
const LETTER_SPACING_DECIMALS = 2;

/**
 * Resolves a line-height ratio against a size, in whole points.
 *
 * @param size - Font size in points.
 * @param ratio - Line-height as a multiple of size.
 * @returns Line-height in points.
 */
function resolveLineHeight(size: number, ratio: number): number {
  return Math.round(size * ratio);
}

/**
 * Resolves a tracking ratio against a size.
 *
 * @param size - Font size in points.
 * @param ratio - Tracking as a multiple of size (an em value).
 * @returns Tracking in points.
 */
function resolveLetterSpacing(size: number, ratio: number): number {
  return Number((size * ratio).toFixed(LETTER_SPACING_DECIMALS));
}

/**
 * Builds a scripture style. The only way to reach the serif.
 *
 * @param step - A step on the scripture scale. Defaults to `md`, the 20 pt reading size.
 * @param weight - `regular` for body, `semiBold` for emphasis. Defaults to `regular`.
 * @returns A style whose line-height is 1.6x its size, per `design-language.md` §3.
 */
export function scriptureText(
  step: ScriptureStep = 'md',
  weight: ScriptureWeight = 'regular',
): TextStyleToken {
  const fontSize = scriptureSize[step];
  return {
    fontFamily: fontFamily.scripture[weight],
    fontSize,
    fontWeight: WEIGHT_VALUE[weight],
    lineHeight: resolveLineHeight(fontSize, LINE_HEIGHT_RATIO.scripture),
    letterSpacing: resolveLetterSpacing(fontSize, LETTER_SPACING_RATIO.scripture),
  };
}

/**
 * Builds a UI style — headings, labels, buttons, and non-scripture body copy.
 *
 * @param step - A step on the UI scale. Defaults to `md`, the 15 pt body size.
 * @param weight - Defaults to `regular`.
 * @returns A style whose line-height is 1.4x its size.
 */
export function uiText(step: UiStep = 'md', weight: UiWeight = 'regular'): TextStyleToken {
  const fontSize = uiSize[step];
  return {
    fontFamily: fontFamily.ui[weight],
    fontSize,
    fontWeight: WEIGHT_VALUE[weight],
    lineHeight: resolveLineHeight(fontSize, LINE_HEIGHT_RATIO.ui),
    letterSpacing: resolveLetterSpacing(fontSize, LETTER_SPACING_RATIO.ui),
  };
}

/**
 * Builds a metadata style — verse references, lexicon numbers, dates, stat labels.
 *
 * Always uppercase and always tracked: that pairing, not the size, is what makes the family
 * read as metadata rather than as small body copy.
 *
 * @param step - A step on the metadata scale. Defaults to `sm`, 10 pt.
 * @param weight - Defaults to `medium`.
 * @returns An uppercase style tracked at 0.16em.
 */
export function metadataText(
  step: MetadataStep = 'sm',
  weight: MetadataWeight = 'medium',
): MetadataStyleToken {
  const fontSize = metadataSize[step];
  return {
    fontFamily: fontFamily.metadata[weight],
    fontSize,
    fontWeight: WEIGHT_VALUE[weight],
    lineHeight: resolveLineHeight(fontSize, LINE_HEIGHT_RATIO.metadata),
    letterSpacing: resolveLetterSpacing(fontSize, LETTER_SPACING_RATIO.metadata),
    textTransform: 'uppercase',
  };
}
