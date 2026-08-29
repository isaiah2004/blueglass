/**
 * Tests for the spacing and sizing tokens.
 *
 * The scale's whole value is that it is a scale: every step a multiple of the same base
 * unit, strictly ascending, with nothing arbitrary smuggled in. A test is the only thing
 * that keeps that true once other agents start adding steps.
 */

import { describe, expect, it } from 'vitest';

import { size, spacing } from './spacing';

/** The rhythm every spacing step must land on. */
const BASE_UNIT = 4;

describe('the spacing scale', () => {
  it('lands every step on the 4-point rhythm', () => {
    for (const step of Object.values(spacing)) {
      expect(step % BASE_UNIT).toBe(0);
    }
  });

  it('ascends strictly, so a larger name is always a larger gap', () => {
    const steps = Object.values(spacing);
    const ascending = [...steps].sort((left, right) => left - right);

    expect(steps).toEqual(ascending);
    expect(new Set(steps).size).toBe(steps.length);
  });

  it('starts at an explicit zero rather than leaving a reset untokenised', () => {
    expect(spacing.none).toBe(0);
  });

  it('holds the screen gutter and section rhythm the layouts assume', () => {
    expect(spacing.lg).toBe(16);
    expect(spacing.xl).toBe(24);
  });
});

describe('element sizes', () => {
  it('gives every small control one shared height', () => {
    expect(size.control).toBe(32);
  });

  it('keeps the inline badge inside the 22-24 pt band design-language.md section 5 sets', () => {
    expect(size.badge).toBeGreaterThanOrEqual(22);
    expect(size.badge).toBeLessThanOrEqual(24);
  });

  it('keeps every touch target at or above 44 pt', () => {
    expect(size.tapTarget).toBeGreaterThanOrEqual(44);
  });

  it('makes the badge shorter than a tap target, so its hit area must be padded out', () => {
    expect(size.badge).toBeLessThan(size.tapTarget);
  });

  it('ascends through the icon sizes', () => {
    expect(size.icon.sm).toBeLessThan(size.icon.md);
    expect(size.icon.md).toBeLessThan(size.icon.lg);
  });

  it('gives the sheet grab handle a wide, thin shape', () => {
    expect(size.grabHandle.width).toBeGreaterThan(size.grabHandle.height);
  });

  it('uses whole points everywhere — a fractional layout value would blur on a low-density screen', () => {
    const flat = [
      size.control,
      size.badge,
      size.tapTarget,
      size.verseNumberGutter,
      ...Object.values(size.icon),
      ...Object.values(size.grabHandle),
    ];

    for (const value of flat) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});
