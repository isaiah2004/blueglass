/**
 * Motion tokens.
 *
 * Purpose
 *   `docs/product/design-language.md` §6 asks for a spring slide-up on sheets, 150 ms
 *   bounce-free state changes, and — critically — that `prefers-reduced-motion` replaces
 *   movement with a cross-fade. That last clause is why motion is a *pair* of token sets
 *   rather than a list of durations: a component asks `motionFor(...)` for the set that
 *   applies and reads the same key names either way.
 *
 * Key responsibilities
 *   - Named durations, loop periods, easing curves, springs, and list stagger.
 *   - `motion` (full) and `reducedMotion` (cross-fade only), both of type `MotionTokens`.
 *   - `transition`, which tells a component *which behaviour to build* rather than making
 *     it infer that from a duration.
 *
 * How a component uses the reduced set
 *   Read `transition`. When it is `'cross-fade'`, do not translate, scale, or rotate
 *   anything — fade between the two states — and skip any looping animation, whose period
 *   is 0 in that set.
 *
 * Dependencies
 *   None. Pure data — no React, no React Native. Reading the OS preference is a component's
 *   job (`AccessibilityInfo.isReduceMotionEnabled`), not this module's.
 *
 * Usage
 *   ```ts
 *   const tokens = motionFor(isReduceMotionEnabled);
 *   withTiming(1, { duration: tokens.duration.sheet, easing: Easing.bezier(...tokens.easing.sheet) });
 *   ```
 */

/** A cubic-Bezier curve as its four control values, ready to spread into an easing factory. */
export type EasingCurve = readonly [number, number, number, number];

/** A spring, in the terms both Reanimated and React Native's Animated accept. */
export interface SpringConfig {
  /** How quickly the oscillation decays. Higher settles sooner. */
  readonly damping: number;
  /** How hard the spring pulls. Higher arrives sooner. */
  readonly stiffness: number;
  /** The animated body's mass. Higher overshoots more. */
  readonly mass: number;
}

/** Named one-shot durations, in milliseconds. */
export type DurationName = 'instant' | 'press' | 'fast' | 'medium' | 'sheet' | 'slow';

/** Named looping animation periods, in milliseconds. */
export type LoopName = 'shimmer' | 'spinner';

/** Named easing curves. */
export type EasingName = 'standard' | 'sheet' | 'decelerate' | 'linear';

/** Named springs. */
export type SpringName = 'sheet';

/** Named list-entrance stagger intervals, in milliseconds. */
export type StaggerName = 'listItem';

/** What a component should actually do with a state change. */
export type TransitionStyle = 'motion' | 'cross-fade';

/** A complete motion vocabulary. Both the full and the reduced set fill this shape. */
export interface MotionTokens {
  /** One-shot durations in milliseconds. */
  readonly duration: Readonly<Record<DurationName, number>>;
  /**
   * Looping animation periods in milliseconds. A period of 0 means the loop is disabled and
   * the component must render its static state instead.
   */
  readonly loop: Readonly<Record<LoopName, number>>;
  readonly easing: Readonly<Record<EasingName, EasingCurve>>;
  readonly spring: Readonly<Record<SpringName, SpringConfig>>;
  /** Delay added per list index on an entrance. 0 means reveal the list at once. */
  readonly staggerMs: Readonly<Record<StaggerName, number>>;
  /** `'motion'` to move; `'cross-fade'` to fade in place. */
  readonly transition: TransitionStyle;
}

/** Every reduced-motion transition uses this single duration (§6: replace movement with a cross-fade). */
const CROSS_FADE_MS = 150;

/**
 * A press-down highlight, in milliseconds.
 *
 * Identical in both sets. It is already an opacity change rather than movement, and reduced
 * motion must never make a touch response *slower* than it was — that reads as lag, not calm.
 */
const PRESS_FEEDBACK_MS = 120;

/**
 * Easing curves. Shared by both sets: reduced motion changes *what* moves, not how a fade
 * is timed, and a fade still wants a curve.
 */
const EASING = {
  /** The house curve — every transition that has no reason to be different. */
  standard: [0.22, 0.9, 0.28, 1],
  /** Sheets: a long tail so the slide-up decelerates into place (§6). */
  sheet: [0.32, 0.72, 0, 1],
  /** Entrances: starts at full speed, eases out. */
  decelerate: [0, 0, 0.2, 1],
  /** No easing. Progress indicators and route-line draws only. */
  linear: [0, 0, 1, 1],
} as const satisfies Record<EasingName, EasingCurve>;

/** The full motion set — the default, for a reader who has not asked for less movement. */
export const motion: MotionTokens = {
  duration: {
    /** 0 — an immediate change, still expressed as a token. */
    instant: 0,
    /** 120 — a press-down highlight, fast enough to feel like touch rather than animation. */
    press: PRESS_FEEDBACK_MS,
    /** 150 — §6's bounce-free state transition. The default for anything not listed here. */
    fast: 150,
    /** 240 — highlights, pill selection, tab cross-fades. */
    medium: 240,
    /** 320 — the sheet slide-up and its backdrop dim, in parallel (§6). */
    sheet: 320,
    /** 460 — a large entrance, such as a screen's first paint. */
    slow: 460,
  },
  loop: {
    /** 1250 — one skeleton shimmer sweep. */
    shimmer: 1250,
    /** 1000 — one spinner revolution. */
    spinner: 1000,
  },
  easing: EASING,
  spring: {
    /** The sheet's slide-up: settles in roughly 320 ms with no visible overshoot. */
    sheet: { damping: 26, stiffness: 220, mass: 1 },
  },
  staggerMs: {
    /** 55 — per-index delay on a list entrance. */
    listItem: 55,
  },
  transition: 'motion',
};

/**
 * The reduced set, for `prefers-reduced-motion`.
 *
 * Every transition duration collapses to a single cross-fade, loops are disabled, stagger is
 * removed, and the spring is critically damped so a component that still uses one cannot
 * overshoot. Two durations are deliberately untouched: `instant`, because an instant swap is
 * its own accessibility problem, and `press`, because a touch response must never get slower.
 */
export const reducedMotion: MotionTokens = {
  duration: {
    instant: 0,
    press: PRESS_FEEDBACK_MS,
    fast: CROSS_FADE_MS,
    medium: CROSS_FADE_MS,
    sheet: CROSS_FADE_MS,
    slow: CROSS_FADE_MS,
  },
  loop: {
    shimmer: 0,
    spinner: 0,
  },
  easing: EASING,
  spring: {
    sheet: { damping: 100, stiffness: 220, mass: 1 },
  },
  staggerMs: {
    listItem: 0,
  },
  transition: 'cross-fade',
};

/**
 * Picks the motion set that applies.
 *
 * @param isReduceMotionEnabled - The reader's OS preference, as reported by
 *   `AccessibilityInfo.isReduceMotionEnabled()`.
 * @returns {@link reducedMotion} when the preference is on, otherwise {@link motion}.
 */
export function motionFor(isReduceMotionEnabled: boolean): MotionTokens {
  return isReduceMotionEnabled ? reducedMotion : motion;
}
