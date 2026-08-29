/**
 * Tests for the route-draw arithmetic.
 *
 * The reduced-motion contract is the one that matters: `design-language.md` §6 requires
 * movement to be replaced by a cross-fade, and the way this implementation honours it is by
 * making the duration zero. If `progressAt` ever returned 0 for a zero duration, the line
 * would be permanently invisible for exactly the readers who asked for less motion.
 */

import { describe, expect, it } from 'vitest';

import { motion, reducedMotion } from '@/theme';

import { dashFor, routeLength, routeSegments } from '../geo/route-path';

import { drawDuration, progressAt } from './draw-progress';

describe('progressAt', () => {
  it('starts at nothing drawn', () => {
    expect(progressAt(0, 460)).toBe(0);
  });

  it('is linear, because an eased draw would read as the ship accelerating', () => {
    expect(progressAt(115, 460)).toBeCloseTo(0.25, 12);
    expect(progressAt(230, 460)).toBeCloseTo(0.5, 12);
    expect(progressAt(345, 460)).toBeCloseTo(0.75, 12);
  });

  it('finishes exactly at the duration and stays finished', () => {
    expect(progressAt(460, 460)).toBe(1);
    expect(progressAt(10_000, 460)).toBe(1);
  });

  it('treats a negative elapsed time as not yet started', () => {
    expect(progressAt(-50, 460)).toBe(0);
  });

  it('finishes immediately for a zero duration — the reduced-motion path', () => {
    expect(progressAt(0, 0)).toBe(1);
  });

  it('finishes immediately rather than emitting NaN for nonsense input', () => {
    expect(progressAt(Number.NaN, 460)).toBe(1);
    expect(progressAt(0, Number.NaN)).toBe(1);
    expect(progressAt(0, -460)).toBe(1);
  });
});

describe('drawDuration', () => {
  it('animates over the slow token when motion is allowed', () => {
    expect(drawDuration(motion.duration.slow, false)).toBe(motion.duration.slow);
  });

  it('collapses to zero when the reader has asked for reduced motion', () => {
    expect(drawDuration(reducedMotion.duration.slow, true)).toBe(0);
    expect(drawDuration(motion.duration.slow, true)).toBe(0);
  });

  it('never returns a negative duration', () => {
    expect(drawDuration(-1, false)).toBe(0);
  });
});

describe('the reduced-motion contract, end to end', () => {
  /** Four projected waypoints, in the pixel space a 358 dp sheet produces. */
  const points = [
    { x: 320, y: 200 },
    { x: 210, y: 120 },
    { x: 60, y: 70 },
    { x: 84, y: 62 },
  ];
  const length = routeLength(routeSegments(points));

  /**
   * The three pure functions `RouteLine` composes, in the order it composes them.
   *
   * This is asserted here rather than in a component test on purpose. The component project
   * aliases `react-native-svg` to a stub that renders each element as a `View` and forwards
   * only `testID` and the ARIA props, so `getAttribute('stroke-dashoffset')` returns `null`
   * — and `Number(null)` is `0`, which is exactly the value a passing reduced-motion
   * assertion would expect. A component test of this contract would therefore pass whether
   * or not the component worked. What a browser actually paints is the walkthrough's
   * question; what the arithmetic says is this file's.
   */
  function offsetAtFirstPaint(isReduceMotionEnabled: boolean): number {
    const tokens = isReduceMotionEnabled ? reducedMotion : motion;
    const duration = drawDuration(tokens.duration.slow, isReduceMotionEnabled);
    return dashFor(length, progressAt(0, duration)).strokeDashoffset;
  }

  it('starts the line fully hidden when it is going to animate', () => {
    expect(offsetAtFirstPaint(false)).toBeCloseTo(length, 9);
    expect(length).toBeGreaterThan(0);
  });

  it('starts the line fully drawn under reduced motion — never one that never arrives', () => {
    expect(offsetAtFirstPaint(true)).toBe(0);
  });

  it('reaches a seamless finish when it does animate', () => {
    const duration = drawDuration(motion.duration.slow, false);
    expect(dashFor(length, progressAt(duration, duration)).strokeDashoffset).toBe(0);
  });
});
