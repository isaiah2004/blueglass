/**
 * Colour tokens — the dark theme.
 *
 * Purpose
 *   The only place a colour value is written down. Components reference a role on the
 *   active theme; they never inline a colour and never reach for a raw hue (CLAUDE.md,
 *   "Where this project overrides ControlSight").
 *
 * Key responsibilities
 *   - Hold the palette from `docs/product/design-language.md` §2, verbatim.
 *   - Derive every alpha-bearing token (badge fills, scrim, glass, ambient glows) from
 *     that palette, so an opacity is never guessed at a call site.
 *   - Export `darkTheme`, and `colors` as the theme currently in force. Swapping themes
 *     later (`D-01`) is a change to this file plus a provider — never to a component.
 *
 * Accessibility
 *   Measured ratios for every key pair live in `colors.contrast.test.ts`, which fails if
 *   the palette moves. One pair does not meet AA and is called out on `ink.tertiary`.
 *
 * Dependencies
 *   `./color-math` and `./theme-contract`. No React, no React Native.
 *
 * Usage
 *   ```ts
 *   import { colors } from '@/theme';
 *   const styles = StyleSheet.create({ page: { backgroundColor: colors.background.canvas } });
 *   ```
 */

import { withAlpha, type HexColor } from './color-math';
import { type BadgeColors, type Theme } from './theme-contract';

/**
 * The raw palette.
 *
 * Private on purpose: a hue carries no meaning until a role is attached to it, and a
 * component that imported `GOLD` directly would be theme-locked forever.
 */
const PALETTE = {
  /** `bg.canvas` — near-black with a subtle blue cast. */
  canvas: '#05070C',
  /** `bg.elevated` — sheets and the tab bar. */
  elevated: '#0B1018',
  /** `bg.card` — cards at rest. */
  card: '#0E141E',
  /** `bg.cardHover` — the top of a card's gradient. */
  cardHover: '#131B27',
  /** `ink.primary` — body text. */
  inkPrimary: '#E8EDF5',
  /** `ink.secondary` — supporting text. */
  inkSecondary: '#93A0B4',
  /** `ink.tertiary` — labels and metadata. See the AA note on `darkTheme.ink`. */
  inkTertiary: '#5D6A7D',
  /** `accent.gold` — the reader's own journey. */
  gold: '#F0B429',
  /** `accent.goldDim` — gold borders at rest. */
  goldDim: '#8A6414',
  /** `accent.cyan` — the system's intelligence. */
  cyan: '#35D2E8',
  /** `accent.cyanDim` — cyan borders at rest. */
  cyanDim: '#14606C',
  /** `state.success` — a completed step. */
  success: '#34D399',
  /** `state.danger` — an error. */
  danger: '#F87171',
  /** The blue owned by the History and Structure badges. */
  badgeBlue: '#5B8DEF',
  /** The violet owned by the Meditate badge. */
  badgeViolet: '#A78BFA',
  /** The rose owned by the Lineage badge — distinct from gold, cyan, blue and violet so a
   * family-tree sheet is never mistaken for a devotional or an analytical one (`Q-018`). */
  badgeRose: '#E8749C',
  /** Pure white, used only as the source of the translucent border tokens. */
  white: '#FFFFFF',
  /** Pure black, used only as the source of the sheet scrim. */
  black: '#000000',
} as const satisfies Record<string, HexColor>;

/** Opacity of the default hairline border (`line.hairline`). */
const HAIRLINE_ALPHA = 0.08;

/** Opacity of an emphasised border (`line.strong`). */
const STRONG_LINE_ALPHA = 0.16;

/** Opacity of an inline badge's fill (`docs/product/design-language.md` §5). */
const BADGE_SURFACE_ALPHA = 0.1;

/** Opacity of an inline badge's 1 px border (§5). */
const BADGE_BORDER_ALPHA = 0.35;

/** Opacity of the scrim behind an open sheet (§6). */
const SCRIM_ALPHA = 0.6;

/** Opacity of a glass sheet's fill — the middle of §4's 86–92 % range. */
const GLASS_ALPHA = 0.89;

/** Opacity of the gold ambient glow from the top-left (§2, "very low-opacity"). */
const AMBIENT_GOLD_ALPHA = 0.08;

/** Opacity of the cyan ambient glow from the top-right (§2). */
const AMBIENT_CYAN_ALPHA = 0.06;

/**
 * Builds one badge's three colours from its single hue.
 *
 * @param hue - The badge type's hue.
 * @returns Tint, fill, and border at the opacities `docs/product/design-language.md` §5 fixes.
 */
function badgeColorsFor(hue: HexColor): BadgeColors {
  return {
    tint: hue,
    surface: withAlpha(hue, BADGE_SURFACE_ALPHA),
    border: withAlpha(hue, BADGE_BORDER_ALPHA),
  };
}

/**
 * The dark, cinematic theme — the one the mockups establish and `D-01` defaults to.
 *
 * `satisfies Theme` proves every role is filled without widening the literal types, so a
 * component still sees `'#05070C'` rather than `string`.
 */
export const darkTheme = {
  name: 'dark',

  background: {
    canvas: PALETTE.canvas,
    elevated: PALETTE.elevated,
    card: PALETTE.card,
    cardHover: PALETTE.cardHover,
  },

  line: {
    hairline: withAlpha(PALETTE.white, HAIRLINE_ALPHA),
    strong: withAlpha(PALETTE.white, STRONG_LINE_ALPHA),
  },

  ink: {
    primary: PALETTE.inkPrimary,
    secondary: PALETTE.inkSecondary,
    // ACCESSIBILITY: 3.36:1 on `background.card` — below WCAG AA's 4.5:1 for normal text.
    // Legal uses are large text (>= 18.66 pt regular / 14 pt bold), icons, and rules, all of
    // which clear the 3:1 non-text bar. The 9-11 pt metadata style takes `ink.secondary`
    // instead (assumption `Q-017`). `colors.contrast.test.ts` locks this.
    tertiary: PALETTE.inkTertiary,
  },

  accent: {
    gold: PALETTE.gold,
    goldDim: PALETTE.goldDim,
    cyan: PALETTE.cyan,
    cyanDim: PALETTE.cyanDim,
  },

  state: {
    success: PALETTE.success,
    danger: PALETTE.danger,
  },

  badge: {
    route: badgeColorsFor(PALETTE.cyan),
    city3d: badgeColorsFor(PALETTE.gold),
    history: badgeColorsFor(PALETTE.badgeBlue),
    manuscript: badgeColorsFor(PALETTE.cyan),
    crossRef: badgeColorsFor(PALETTE.gold),
    root: badgeColorsFor(PALETTE.cyan),
    lineage: badgeColorsFor(PALETTE.badgeRose),
    structure: badgeColorsFor(PALETTE.badgeBlue),
    cultural: badgeColorsFor(PALETTE.gold),
    context: badgeColorsFor(PALETTE.cyan),
    meditate: badgeColorsFor(PALETTE.badgeViolet),
  },

  overlay: {
    scrim: withAlpha(PALETTE.black, SCRIM_ALPHA),
    glass: withAlpha(PALETTE.elevated, GLASS_ALPHA),
  },

  ambient: {
    gold: withAlpha(PALETTE.gold, AMBIENT_GOLD_ALPHA),
    cyan: withAlpha(PALETTE.cyan, AMBIENT_CYAN_ALPHA),
  },

  cardGradient: [PALETTE.cardHover, PALETTE.card],
} as const satisfies Theme;

/**
 * The theme in force.
 *
 * Every component imports this, and that is the problem to be aware of before planning
 * light mode. Resolved decision `D-01` requires light mode to be built and shipped, with
 * every component verified in both themes. This binding cannot deliver that: it is a
 * module constant, read at module-evaluation time inside `StyleSheet.create`, so the value
 * is baked in before the first render and no provider can change it afterwards.
 *
 * What shipping `D-01` actually costs, so nobody plans it as a one-file change:
 *   1. A `lightTheme` satisfying `Theme` (`./theme-contract`), passing the same contrast
 *      audit `colors.contrast.test.ts` applies to the dark one.
 *   2. A React context, its provider in `app/_layout.tsx`, and a `useTheme()` hook —
 *      none of which exist today (grep for `createContext`, `useColorScheme` or
 *      `ThemeProvider` under `apps/mobile` returns nothing).
 *   3. Every styled component moved off module-scope `StyleSheet.create(...)` reading this
 *      constant, and onto styles derived from the theme it is rendered under.
 *   4. The walkthrough in `e2e/` run against both themes.
 *
 * Until (1)–(3) land, this export stays the single dark theme. Keep importing it: the
 * import site is what step 3 rewrites, and a component that reaches past it into
 * `darkTheme` directly would have to be found and fixed twice.
 */
export const colors = darkTheme;

/**
 * The opaque surfaces a contrast audit can measure against.
 *
 * Exported so `colors.contrast.test.ts` and any future QA screen iterate the real list
 * instead of restating it.
 */
export const auditableSurfaces = {
  canvas: PALETTE.canvas,
  elevated: PALETTE.elevated,
  card: PALETTE.card,
  cardHover: PALETTE.cardHover,
} as const satisfies Record<string, HexColor>;
