/**
 * Tests for the shape tokens.
 *
 * `docs/product/design-language.md` §4 fixes three radius bands. These tests assert the
 * bands rather than the exact numbers wherever the design language gave a range, so a later
 * tweak inside the band passes and a drift outside it does not.
 */

import { describe, expect, it } from 'vitest';

import { borderWidth, radius } from './radius';

describe('corner radii', () => {
  it('keeps controls inside the 10-11 pt band', () => {
    expect(radius.control).toBeGreaterThanOrEqual(10);
    expect(radius.control).toBeLessThanOrEqual(11);
  });

  it('keeps cards and sheets inside the 14-16 pt band', () => {
    for (const value of [radius.card, radius.sheet]) {
      expect(value).toBeGreaterThanOrEqual(14);
      expect(value).toBeLessThanOrEqual(16);
    }
  });

  it('gives a sheet a softer corner than a card, and a card a softer corner than a control', () => {
    expect(radius.control).toBeLessThan(radius.card);
    expect(radius.card).toBeLessThan(radius.sheet);
  });

  it('makes a pill unambiguously a pill at any height', () => {
    expect(radius.pill).toBe(999);
  });

  it('tokenises the square corner rather than letting a component write 0', () => {
    expect(radius.none).toBe(0);
  });

  it('uses whole points for every radius', () => {
    for (const value of Object.values(radius)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('border widths', () => {
  it('draws every design-language border at 1 pt', () => {
    expect(borderWidth.hairline).toBe(1);
  });

  it('makes a focus ring visibly heavier than a hairline', () => {
    expect(borderWidth.focus).toBeGreaterThan(borderWidth.hairline);
  });

  it('tokenises the absence of a stroke', () => {
    expect(borderWidth.none).toBe(0);
  });
});
