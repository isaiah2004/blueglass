/**
 * Tests for the colour value arithmetic.
 *
 * Covers the three things the token layer depends on being exactly right: reading a colour
 * into channels, deriving an alpha variant, and compositing a translucent colour over an
 * opaque one. Every expected value here is computed by hand, not by the implementation.
 */

import { describe, expect, it } from 'vitest';

import {
  InvalidColorError,
  flattenOver,
  toRgbaChannels,
  withAlpha,
  withOpacity,
  type Color,
} from './color-math';

describe('toRgbaChannels', () => {
  it('reads a six-digit hex colour into channels at full opacity', () => {
    const channels = toRgbaChannels('#F0B429');

    expect(channels).toEqual({ red: 240, green: 180, blue: 41, alpha: 1 });
  });

  it('reads pure black and pure white at the ends of the range', () => {
    expect(toRgbaChannels('#000000')).toEqual({ red: 0, green: 0, blue: 0, alpha: 1 });
    expect(toRgbaChannels('#FFFFFF')).toEqual({ red: 255, green: 255, blue: 255, alpha: 1 });
  });

  it('is case-insensitive about hex digits', () => {
    expect(toRgbaChannels('#35d2e8')).toEqual(toRgbaChannels('#35D2E8'));
  });

  it('reads an rgba colour, keeping its alpha', () => {
    const channels = toRgbaChannels('rgba(255,255,255,0.08)');

    expect(channels).toEqual({ red: 255, green: 255, blue: 255, alpha: 0.08 });
  });

  it('rejects a hex colour of the wrong length', () => {
    expect(() => toRgbaChannels('#FFF')).toThrow(InvalidColorError);
  });

  it('rejects a string that only looks like a colour', () => {
    expect(() => toRgbaChannels('#GGGGGG')).toThrow(InvalidColorError);
    expect(() => toRgbaChannels('rgba(1,2,3)' as Color)).toThrow(InvalidColorError);
  });

  it('names the offending value in the error message', () => {
    expect(() => toRgbaChannels('#ZZZZZZ')).toThrow(/#ZZZZZZ/);
  });
});

describe('withAlpha', () => {
  it('derives the inline badge fill at 10 percent of its hue', () => {
    expect(withAlpha('#35D2E8', 0.1)).toBe('rgba(53,210,232,0.1)');
  });

  it('derives the inline badge border at 35 percent of its hue', () => {
    expect(withAlpha('#35D2E8', 0.35)).toBe('rgba(53,210,232,0.35)');
  });

  it('keeps a fully opaque derivation readable', () => {
    expect(withAlpha('#F0B429', 1)).toBe('rgba(240,180,41,1)');
  });

  it('rounds alpha to two decimals so equal opacities are equal strings', () => {
    expect(withAlpha('#000000', 0.123456)).toBe('rgba(0,0,0,0.12)');
  });

  it('rejects an opacity outside 0 to 1', () => {
    expect(() => withAlpha('#000000', -0.1)).toThrow(InvalidColorError);
    expect(() => withAlpha('#000000', 1.5)).toThrow(InvalidColorError);
    expect(() => withAlpha('#000000', Number.NaN)).toThrow(InvalidColorError);
  });
});

describe('flattenOver', () => {
  it('returns an opaque colour unchanged', () => {
    expect(flattenOver('#05070C', '#FFFFFF')).toBe('#05070C');
  });

  it('returns the background when the foreground is fully transparent', () => {
    expect(flattenOver('rgba(255,255,255,0)', '#05070C')).toBe('#05070C');
  });

  it('composites a half-opacity white over black to mid grey', () => {
    expect(flattenOver('rgba(255,255,255,0.5)', '#000000')).toBe('#808080');
  });

  it('composites the cyan badge fill over the canvas', () => {
    // 0.1 * 53 + 0.9 * 5 = 9.8 -> 10 (0x0A); 0.1 * 210 + 0.9 * 7 = 27.3 -> 27 (0x1B);
    // 0.1 * 232 + 0.9 * 12 = 34.0 -> 34 (0x22).
    expect(flattenOver('rgba(53,210,232,0.1)', '#05070C')).toBe('#0A1B22');
  });

  it('pads a dark result to six digits rather than emitting a short hex', () => {
    expect(flattenOver('rgba(0,0,1,1)', '#FFFFFF')).toBe('#000001');
  });
});

describe('withOpacity', () => {
  it('re-alphas an opaque token exactly like withAlpha', () => {
    expect(withOpacity('#F0B429', 0.35)).toBe(withAlpha('#F0B429', 0.35));
  });

  it('multiplies rather than replaces an existing alpha', () => {
    // The difference that matters: halving a hairline must halve it, not make it solid.
    const hairline = withAlpha('#FFFFFF', 0.08);

    expect(withOpacity(hairline, 0.5)).toBe('rgba(255,255,255,0.04)');
  });

  it('collapses to fully transparent at zero and preserves the value at one', () => {
    expect(withOpacity('#35D2E8', 0)).toBe('rgba(53,210,232,0)');
    expect(withOpacity('#35D2E8', 1)).toBe('rgba(53,210,232,1)');
  });

  it('refuses an alpha outside the unit range', () => {
    expect(() => withOpacity('#35D2E8', 1.5)).toThrow(InvalidColorError);
    expect(() => withOpacity('#35D2E8', -0.1)).toThrow(InvalidColorError);
    expect(() => withOpacity('#35D2E8', Number.NaN)).toThrow(InvalidColorError);
  });
});
