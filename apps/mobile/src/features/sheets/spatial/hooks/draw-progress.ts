/**
 * The arithmetic behind the route line's progressive draw.
 *
 * Purpose
 *   `design-language.md` §6 asks for route lines that "draw progressively", and §6 also
 *   says `prefers-reduced-motion` replaces movement with a cross-fade. Both rules are
 *   arithmetic on an elapsed time, so both live here as pure functions and neither lives
 *   in a component.
 *
 * Why not Reanimated
 *   Measured, not assumed. Animating an SVG attribute with Reanimated needs
 *   `createAnimatedComponent(Path)` plus `useAnimatedProps`, which on the web goes through
 *   `react-native-worklets` — the same package whose module layout Vitest's resolver
 *   cannot follow, which is why `features/reader/testing/reanimated-stub.tsx` exists at
 *   all. For one number driving one attribute on one node, a `requestAnimationFrame` loop
 *   is fewer moving parts, behaves identically on web and native, and is testable as the
 *   two pure functions below. Reanimated remains the right tool for gestures and for the
 *   sheet's own spring; it is the wrong one for this.
 *
 * Dependencies
 *   None. No React, no timers — the hook that drives these is next door.
 */

/** Easing for the draw. Linear on purpose — see {@link progressAt}. */
export type DrawEasing = 'linear';

/**
 * How much of the line is drawn after a given elapsed time.
 *
 * Linear, and deliberately so: `theme/motion.ts` reserves its `linear` curve for "progress
 * indicators and route-line draws only". An eased draw reads as a ship accelerating, which
 * is a claim about the voyage rather than about the drawing.
 *
 * @param elapsedMs - Milliseconds since the draw began. Negative is treated as zero.
 * @param durationMs - How long the draw takes. Zero or less finishes immediately, which is
 *   what the reduced-motion token set collapses to.
 * @returns A number in `[0, 1]`. Side effects: none.
 */
export function progressAt(elapsedMs: number, durationMs: number): number {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(durationMs) || durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedMs / durationMs));
}

/**
 * How long the draw should take.
 *
 * @param slowDurationMs - `motion.duration.slow` from the token set in force. Under
 *   reduced motion that token is already the cross-fade duration, so the draw shortens to
 *   a fade without this module knowing why.
 * @param isReduceMotionEnabled - The reader's preference.
 * @returns The duration to animate over; `0` when motion is reduced, which
 *   {@link progressAt} turns into "already finished" and the component turns into a fade.
 *   Side effects: none.
 */
export function drawDuration(slowDurationMs: number, isReduceMotionEnabled: boolean): number {
  return isReduceMotionEnabled ? 0 : Math.max(0, slowDurationMs);
}
