/**
 * Colour tokens — the light theme.
 *
 * Purpose
 *   Decision `D-01` is explicit that light mode must *ship*, not merely be made possible
 *   by the token contract. This file is the second `Theme` the contract always promised:
 *   same roles, same derivations, a different palette.
 *
 * Why it is not the dark palette inverted
 *   Every saturated accent in `colors.ts` was chosen to sit on near-black. `accent.cyan`
 *   (`#35D2E8`) measures 1.62:1 on white — a quarter of what WCAG AA asks of text. So the
 *   two meaning-bearing hues keep their *meaning* (gold = you, cyan = the system) and lose
 *   their luminance: each becomes the dark, ink-weight version of the same hue. The dim
 *   variants move the other way, because a resting border on paper has to be darker than
 *   the paper, not lighter.
 *
 * The paper
 *   Warm off-white rather than pure white, following the Flutter prototype's reading
 *   canvas (`theme.dart`: `paper #FBF9F5`). A pure-white scripture page glares under the
 *   long reads pillar 4 asks for; the warm cast costs nothing in contrast (`ink.primary`
 *   still measures 16:1) and is materially easier to sit with.
 *
 * Accessibility
 *   Measured, not assumed. `light-colors.contrast.test.ts` locks every pair, including the
 *   two that deliberately fall short and why. `ink.tertiary` fails AA for normal text in
 *   *both* themes, on purpose: keeping the same shortfall keeps the same usage rule
 *   (`Q-017` — large text, icons and rules only), and a rule that changes with the theme
 *   is a rule nobody follows.
 *
 * Dependencies
 *   `./color-math` and `./theme-contract`. No React, no React Native.
 */

import { withAlpha, type HexColor } from './color-math';
import { type BadgeColors, type Theme } from './theme-contract';

/**
 * The raw light palette.
 *
 * Private for the same reason `colors.ts` keeps its palette private: a hue means nothing
 * until a role is attached, and a component that imported one would be theme-locked.
 */
const PALETTE = {
  /** `bg.canvas` — warm paper, the app background. */
  canvas: '#F7F5F1',
  /** `bg.elevated` — sheets and the tab bar, one step *lighter* than the canvas. */
  elevated: '#FDFCFA',
  /** `bg.card` — cards at rest. The brightest surface, so a card lifts off the page. */
  card: '#FFFFFF',
  /** `bg.cardHover` — the top of a card's gradient; the warm tint returning. */
  cardHover: '#FBF9F5',
  /** `ink.primary` — body text. Near-black with the same blue cast as the dark canvas. */
  inkPrimary: '#161A21',
  /** `ink.secondary` — supporting text, and all 9-11 pt metadata (`Q-017`). */
  inkSecondary: '#4B5563',
  /** `ink.tertiary` — large text, icons and rules only. Below AA as normal text. */
  inkTertiary: '#818B99',
  /** `accent.gold` — the reader's own journey, at ink weight. */
  gold: '#8A5B0B',
  /** `accent.goldDim` — gold borders at rest; lighter than the ink gold, darker than paper. */
  goldDim: '#A9761A',
  /** `accent.cyan` — the system's intelligence, at ink weight. */
  cyan: '#0B6C7A',
  /** `accent.cyanDim` — cyan borders at rest. */
  cyanDim: '#2E8B99',
  /** `state.success` — a completed step. */
  success: '#0F7A4E',
  /** `state.danger` — an error. */
  danger: '#B3261E',
  /** The blue owned by the History and Structure badges. */
  badgeBlue: '#2A55C4',
  /** The violet owned by the Meditate badge. */
  badgeViolet: '#6742C1',
  /** Pure black, the source of every translucent line and the scrim. */
  black: '#000000',
} as const satisfies Record<string, HexColor>;

/** Opacity of the default hairline border. Higher than dark's 8 % — black on paper reads
 * fainter than white on near-black at the same alpha. */
const HAIRLINE_ALPHA = 0.1;

/** Opacity of an emphasised border. */
const STRONG_LINE_ALPHA = 0.18;

/** Opacity of an inline badge's fill (`docs/product/design-language.md` §5). */
const BADGE_SURFACE_ALPHA = 0.1;

/** Opacity of an inline badge's 1 px border (§5). */
const BADGE_BORDER_ALPHA = 0.35;

/** Opacity of the scrim behind an open sheet. Lighter than dark's 60 %: a heavy scrim on
 * paper reads as a broken screen rather than as depth. */
const SCRIM_ALPHA = 0.32;

/** Opacity of a glass sheet's fill. */
const GLASS_ALPHA = 0.9;

/** Opacity of the gold ambient glow from the top-left. */
const AMBIENT_GOLD_ALPHA = 0.09;

/** Opacity of the cyan ambient glow from the top-right. */
const AMBIENT_CYAN_ALPHA = 0.07;

/**
 * Builds one badge's three colours from its single hue.
 *
 * @param hue - The badge type's hue.
 * @returns Tint, fill, and border at the opacities `design-language.md` §5 fixes.
 */
function badgeColorsFor(hue: HexColor): BadgeColors {
  return {
    tint: hue,
    surface: withAlpha(hue, BADGE_SURFACE_ALPHA),
    border: withAlpha(hue, BADGE_BORDER_ALPHA),
  };
}

/** The light theme. Same roles as `darkTheme`, different palette. */
export const lightTheme = {
  name: 'light',

  background: {
    canvas: PALETTE.canvas,
    elevated: PALETTE.elevated,
    card: PALETTE.card,
    cardHover: PALETTE.cardHover,
  },

  line: {
    hairline: withAlpha(PALETTE.black, HAIRLINE_ALPHA),
    strong: withAlpha(PALETTE.black, STRONG_LINE_ALPHA),
  },

  ink: {
    primary: PALETTE.inkPrimary,
    secondary: PALETTE.inkSecondary,
    // ACCESSIBILITY: 3.17-3.45:1 across the four surfaces — below WCAG AA's 4.5:1 for
    // normal text, above the 3:1 bar for large text, icons and rules. Identical rule to
    // the dark theme (`Q-017`). `light-colors.contrast.test.ts` locks this.
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
 * The opaque light surfaces a contrast audit can measure against.
 *
 * Mirrors `auditableSurfaces` in `colors.ts` so both audits iterate a real list rather
 * than restating one.
 */
export const lightAuditableSurfaces = {
  canvas: PALETTE.canvas,
  elevated: PALETTE.elevated,
  card: PALETTE.card,
  cardHover: PALETTE.cardHover,
} as const satisfies Record<string, HexColor>;
