/**
 * Tests for the scripture column's two shaping numbers.
 *
 * The `0`-means-uncapped conversion is the one that matters: shipping `maxWidth: 0` would
 * collapse the reading column to nothing on every phone.
 */

import { readingMeasure, spacing, type FormFactor } from '@/theme';
import { describe, expect, it } from 'vitest';

import { columnMaxWidth, readerGutterFor } from './reader-canvas';

const FORM_FACTORS: readonly FormFactor[] = ['phone', 'tablet', 'desktop'];

describe('readerGutterFor', () => {
  it('answers for every form factor with a spacing token', () => {
    const scale = Object.values(spacing);
    for (const form of FORM_FACTORS) {
      expect(scale).toContain(readerGutterFor(form));
    }
  });

  it('gives a phone the tightest gutter and never a tighter one to a larger screen', () => {
    expect(readerGutterFor('phone')).toBeLessThan(readerGutterFor('tablet'));
    expect(readerGutterFor('tablet')).toBeLessThanOrEqual(readerGutterFor('desktop'));
  });
});

describe('columnMaxWidth', () => {
  it('treats the design system’s 0 as uncapped, not as zero width', () => {
    expect(columnMaxWidth(readingMeasure.phone)).toBeUndefined();
  });

  it('passes a real cap straight through', () => {
    expect(columnMaxWidth(readingMeasure.tablet)).toBe(readingMeasure.tablet);
    expect(columnMaxWidth(readingMeasure.desktop)).toBe(readingMeasure.desktop);
  });

  it('never returns zero', () => {
    for (const form of FORM_FACTORS) {
      expect(columnMaxWidth(readingMeasure[form])).not.toBe(0);
    }
  });
});
