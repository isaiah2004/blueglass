/**
 * Tests for WCAG contrast measurement.
 *
 * The expected values are the published reference points for the algorithm — black on
 * white is exactly 21:1, a colour on itself is exactly 1:1, and #767676 on white sits just
 * above AA's 4.5:1 threshold, which is why that grey is the canonical "smallest passing"
 * example. If this file is right, the palette audit built on it can be trusted.
 */

import { describe, expect, it } from 'vitest';

import { CONTRAST_MINIMUM, contrastRatio, meetsContrast, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('puts black at 0 and white at 1', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBe(1);
  });

  it('weights green far above blue, per the CIE luminance sum', () => {
    expect(relativeLuminance('#00FF00')).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance('#FF0000')).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance('#0000FF')).toBeCloseTo(0.0722, 4);
  });

  it('uses the linear segment of the transfer function for very dark channels', () => {
    // 10/255 = 0.0392, below the 0.03928 threshold, so the value is divided by 12.92.
    expect(relativeLuminance('#0A0A0A')).toBeCloseTo(0.003035, 5);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black on white, the maximum the scale allows', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('returns 1 for a colour on itself', () => {
    expect(contrastRatio('#35D2E8', '#35D2E8')).toBeCloseTo(1, 5);
  });

  it('is symmetric — order of the pair does not change the ratio', () => {
    expect(contrastRatio('#F0B429', '#05070C')).toBeCloseTo(contrastRatio('#05070C', '#F0B429'), 5);
  });

  it('places #767676 on white just above the AA threshold', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('composites a translucent foreground before measuring', () => {
    const asTranslucent = contrastRatio('rgba(255,255,255,0.5)', '#000000');
    const asFlattened = contrastRatio('#808080', '#000000');

    expect(asTranslucent).toBeCloseTo(asFlattened, 5);
  });
});

describe('meetsContrast', () => {
  it('names the four WCAG thresholds this project measures against', () => {
    expect(CONTRAST_MINIMUM).toEqual({ aaText: 4.5, aaLarge: 3, aaaText: 7, nonText: 3 });
  });

  it('passes black on white at every level', () => {
    expect(meetsContrast('#000000', '#FFFFFF', 'aaText')).toBe(true);
    expect(meetsContrast('#000000', '#FFFFFF', 'aaaText')).toBe(true);
  });

  it('fails a colour against itself at every level', () => {
    expect(meetsContrast('#35D2E8', '#35D2E8', 'nonText')).toBe(false);
  });

  it('separates normal text from large text at the same ratio', () => {
    // 3.36:1 — enough for large text and icons, not enough for body copy.
    expect(meetsContrast('#5D6A7D', '#0E141E', 'aaLarge')).toBe(true);
    expect(meetsContrast('#5D6A7D', '#0E141E', 'aaText')).toBe(false);
  });
});
