/**
 * Tests for the reading-size mapping.
 *
 * The resolver has to be total across every preference crossed with every responsive
 * default, because `medium` is the only one of the three that consults the second
 * argument — and it is the one most readers will be on.
 */

import { scriptureSize as scale, type ScriptureStep } from '@/theme';
import { describe, expect, it } from 'vitest';

import { READING_SIZES, readingSizeLabel, resolveReadingStep } from './reading-size';

const RESPONSIVE_STEPS: readonly ScriptureStep[] = ['sm', 'md', 'lg'];

describe('resolveReadingStep', () => {
  it('follows the window when the reader is on the default', () => {
    for (const step of RESPONSIVE_STEPS) {
      expect(resolveReadingStep('medium', step)).toBe(step);
    }
  });

  it('overrides the window when the reader chose a size', () => {
    for (const step of RESPONSIVE_STEPS) {
      expect(resolveReadingStep('small', step)).toBe('sm');
      expect(resolveReadingStep('large', step)).toBe('lg');
    }
  });

  it('always resolves to a reading step inside §3’s 19-21 pt band', () => {
    for (const size of READING_SIZES) {
      for (const step of RESPONSIVE_STEPS) {
        const resolved = resolveReadingStep(size, step);
        expect(RESPONSIVE_STEPS).toContain(resolved);
        expect(scale[resolved]).toBeGreaterThanOrEqual(19);
        expect(scale[resolved]).toBeLessThanOrEqual(21);
      }
    }
  });

  it('never resolves to a non-scripture step', () => {
    for (const size of READING_SIZES) {
      const resolved = resolveReadingStep(size, 'md');
      expect(resolved).not.toBe('title');
      expect(resolved).not.toBe('display');
    }
  });
});

describe('the control', () => {
  it('offers the store’s three sizes, in order', () => {
    expect(READING_SIZES).toEqual(['small', 'medium', 'large']);
  });

  it('labels every size, and calls the responsive one Default rather than Medium', () => {
    expect(READING_SIZES.map(readingSizeLabel)).toEqual(['Small', 'Default', 'Large']);
  });
});
