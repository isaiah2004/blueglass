/**
 * The colour theme contract.
 *
 * Purpose
 *   Describes *what a theme is* without saying what any colour is. `colors.ts` supplies the
 *   dark implementation; the light theme that question `D-01` leaves open is a second object
 *   satisfying this same type, and adding it must not touch a single component.
 *
 * Key responsibilities
 *   - Name every colour role the app is allowed to reference.
 *   - Enumerate the ten inline-badge types once, as both a runtime list and a union, so the
 *     two can never drift apart.
 *
 * Dependencies
 *   `./color-math` for the `Color` type. No React, no React Native.
 *
 * Usage
 *   ```ts
 *   const lightTheme = { name: 'light', ... } as const satisfies Theme;
 *   ```
 */

import type { Color } from './color-math';

/** Which palette a `Theme` instance is. Dark ships now; light is `D-01`'s open half. */
export type ThemeName = 'dark' | 'light';

/**
 * The ten inline-badge types, in the order `docs/product/design-language.md` §2 lists them.
 *
 * Declared as a runtime tuple because {@link BadgeKind} is derived from it: a new badge type
 * is added in exactly one place, and every theme is then forced by the compiler to give it
 * a hue.
 */
export const badgeKinds = [
  'route',
  'city3d',
  'history',
  'manuscript',
  'crossRef',
  'root',
  'lineage',
  'structure',
  'cultural',
  'context',
  'meditate',
] as const;

/**
 * One of the eleven inline-badge types.
 *
 * `Q-018` (recorded in `docs/product/design-language.md` §2) noted that Lineage had a
 * sheet in the spec but no hue here — this tuple gaining an eleventh entry, and the
 * compile errors that followed in `colors.ts`, `light-colors.ts` and `badge-icons.ts`
 * until each gave it one, is that gap closed.
 */
export type BadgeKind = (typeof badgeKinds)[number];

/** Background surfaces, darkest first. */
export type BackgroundColors = {
  /** The app background. */
  readonly canvas: Color;
  /** Sheets and the tab bar — one step above the canvas. */
  readonly elevated: Color;
  /** Cards at rest; the bottom of a card's vertical gradient. */
  readonly card: Color;
  /** The top of a card's vertical gradient. Never used as a flat fill. */
  readonly cardHover: Color;
};

/** Border colours. Translucent white, never a solid tone, so they sit on any surface. */
export type LineColors = {
  /** The default 1 px border on cards, sheets, and dividers. */
  readonly hairline: Color;
  /** An emphasised border — focus, selection, an active control. */
  readonly strong: Color;
};

/** Text colours, by descending emphasis. */
export type InkColors = {
  /** Body text and scripture. */
  readonly primary: Color;
  /** Supporting text, and any small metadata that must meet WCAG AA. */
  readonly secondary: Color;
  /** Dimmest tier. Large text, icons, and rules only — see the note in `colors.ts`. */
  readonly tertiary: Color;
};

/**
 * The two meaning-bearing accents.
 *
 * Gold means "you" (streaks, progress, primary actions, place names, verse numbers); cyan
 * means "the system" (AI, sources, analysis, navigation). The meanings never swap
 * (`docs/product/design-language.md` §8.2).
 */
export type AccentColors = {
  readonly gold: Color;
  /** Gold borders at rest — dim enough that the fill, not the edge, carries the colour. */
  readonly goldDim: Color;
  readonly cyan: Color;
  /** Cyan borders at rest. */
  readonly cyanDim: Color;
};

/** Status colours. State only — never decoration. */
export type StateColors = {
  /** A completed step in the daily loop. */
  readonly success: Color;
  /** An error. */
  readonly danger: Color;
};

/**
 * One inline badge's three colours, all derived from a single hue.
 *
 * `docs/product/design-language.md` §5: the label and icon take the full hue, the fill is
 * that hue at ~10 %, the 1 px border is that hue at ~35 %.
 */
export type BadgeColors = {
  /** Label, icon, and the tint applied to the annotated word itself. */
  readonly tint: Color;
  /** The pill's fill. */
  readonly surface: Color;
  /** The pill's 1 px border. */
  readonly border: Color;
};

/** Colours that sit over other content. */
export type OverlayColors = {
  /** Dims the reader while a sheet is open. */
  readonly scrim: Color;
  /** The glass fill of a sheet: near-black at 86–92 %, under a heavy backdrop blur. */
  readonly glass: Color;
};

/**
 * The two ambient radial glows.
 *
 * `docs/product/design-language.md` §2: gold from the top-left, cyan from the top-right,
 * both very low opacity. Never a linear gradient across a surface.
 */
export type AmbientColors = {
  readonly gold: Color;
  readonly cyan: Color;
};

/**
 * A complete colour theme.
 *
 * Every colour the app may render is reachable from here. A component that needs a colour
 * this type does not name is asking for a token that does not exist yet — add it here first,
 * so both themes are forced to answer for it.
 */
export interface Theme {
  /** Which palette this is. */
  readonly name: ThemeName;
  readonly background: BackgroundColors;
  readonly line: LineColors;
  readonly ink: InkColors;
  readonly accent: AccentColors;
  readonly state: StateColors;
  /** Every badge type must have a hue — the mapped type makes omitting one a type error. */
  readonly badge: { readonly [Kind in BadgeKind]: BadgeColors };
  readonly overlay: OverlayColors;
  readonly ambient: AmbientColors;
  /** A card's vertical gradient, top first. Cards are never a flat fill (§4). */
  readonly cardGradient: readonly [Color, Color];
}
