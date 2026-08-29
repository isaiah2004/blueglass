/**
 * Tests for the motion tokens.
 *
 * The behaviour that matters is the reduced-motion contract from
 * `docs/product/design-language.md` §6: a reader who has asked for less movement gets a
 * cross-fade, not a faster slide. That means the two sets must be interchangeable — same
 * keys, same types — and the reduced one must actually remove movement.
 */

import { describe, expect, it } from 'vitest';

import { motion, motionFor, reducedMotion, type MotionTokens } from './motion';

/** Both sets must expose exactly these groups, or a component could not swap between them. */
const TOKEN_GROUPS = ['duration', 'loop', 'easing', 'spring', 'staggerMs', 'transition'] as const;

/** Control values in a cubic-Bezier curve. */
const CURVE_CONTROL_COUNT = 4;

describe('the full motion set', () => {
  it('uses 320 ms for the sheet slide-up and its backdrop dim', () => {
    expect(motion.duration.sheet).toBe(320);
  });

  it('uses 150 ms for an ordinary state transition', () => {
    expect(motion.duration.fast).toBe(150);
  });

  it('declares that components should move', () => {
    expect(motion.transition).toBe('motion');
  });

  it('orders the durations from a press up to a large entrance', () => {
    expect(motion.duration.instant).toBeLessThan(motion.duration.press);
    expect(motion.duration.press).toBeLessThan(motion.duration.fast);
    expect(motion.duration.fast).toBeLessThan(motion.duration.medium);
    expect(motion.duration.medium).toBeLessThan(motion.duration.sheet);
    expect(motion.duration.sheet).toBeLessThan(motion.duration.slow);
  });

  it('staggers a list entrance', () => {
    expect(motion.staggerMs.listItem).toBeGreaterThan(0);
  });

  it('runs both looping animations', () => {
    expect(motion.loop.shimmer).toBeGreaterThan(0);
    expect(motion.loop.spinner).toBeGreaterThan(0);
  });
});

describe('the reduced-motion set', () => {
  it('declares that components should cross-fade instead of moving', () => {
    expect(reducedMotion.transition).toBe('cross-fade');
  });

  it('collapses every transition duration to one 150 ms cross-fade', () => {
    const untouched = new Set(['instant', 'press']);
    const transitions = Object.entries(reducedMotion.duration).filter(
      ([name]) => !untouched.has(name),
    );

    expect(transitions).not.toHaveLength(0);
    for (const [, value] of transitions) {
      expect(value).toBe(150);
    }
  });

  it('keeps an instant change instant', () => {
    expect(reducedMotion.duration.instant).toBe(0);
  });

  it('never slows the press highlight — a touch response that lags reads as a broken app', () => {
    expect(reducedMotion.duration.press).toBe(motion.duration.press);
  });

  it('disables both looping animations rather than slowing them', () => {
    expect(reducedMotion.loop.shimmer).toBe(0);
    expect(reducedMotion.loop.spinner).toBe(0);
  });

  it('removes list stagger, so a list reveals at once', () => {
    expect(reducedMotion.staggerMs.listItem).toBe(0);
  });

  it('critically damps the sheet spring, so nothing overshoots even if a spring is still used', () => {
    expect(reducedMotion.spring.sheet.damping).toBeGreaterThan(motion.spring.sheet.damping);
  });

  it('is never slower than the full set', () => {
    for (const name of Object.keys(motion.duration) as (keyof typeof motion.duration)[]) {
      expect(reducedMotion.duration[name]).toBeLessThanOrEqual(motion.duration[name]);
    }
  });
});

describe('the two sets are interchangeable', () => {
  it.each<[string, MotionTokens]>([
    ['motion', motion],
    ['reducedMotion', reducedMotion],
  ])('%s exposes every token group', (_name, tokens) => {
    expect(Object.keys(tokens).sort()).toEqual([...TOKEN_GROUPS].sort());
  });

  it('shares the same duration, loop, easing, spring and stagger keys', () => {
    expect(Object.keys(reducedMotion.duration).sort()).toEqual(Object.keys(motion.duration).sort());
    expect(Object.keys(reducedMotion.loop).sort()).toEqual(Object.keys(motion.loop).sort());
    expect(Object.keys(reducedMotion.easing).sort()).toEqual(Object.keys(motion.easing).sort());
    expect(Object.keys(reducedMotion.spring).sort()).toEqual(Object.keys(motion.spring).sort());
    expect(Object.keys(reducedMotion.staggerMs).sort()).toEqual(
      Object.keys(motion.staggerMs).sort(),
    );
  });
});

describe('easing curves', () => {
  it('gives every curve four control values inside the legal range', () => {
    for (const curve of Object.values(motion.easing)) {
      expect(curve).toHaveLength(CURVE_CONTROL_COUNT);
      expect(curve[0]).toBeGreaterThanOrEqual(0);
      expect(curve[0]).toBeLessThanOrEqual(1);
      expect(curve[2]).toBeGreaterThanOrEqual(0);
      expect(curve[2]).toBeLessThanOrEqual(1);
    }
  });

  it('keeps linear linear', () => {
    expect(motion.easing.linear).toEqual([0, 0, 1, 1]);
  });
});

describe('motionFor', () => {
  it('returns the reduced set when the reader has asked for less movement', () => {
    expect(motionFor(true)).toBe(reducedMotion);
  });

  it('returns the full set otherwise', () => {
    expect(motionFor(false)).toBe(motion);
  });
});
