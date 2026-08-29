/**
 * Tests for the typography tokens.
 *
 * The rules being defended come from `docs/product/design-language.md` §3 and §8.4:
 * scripture reads at 19-21 pt with a 1.6 line-height, metadata is uppercase and tracked
 * between .14em and .18em, and the three families never borrow each other's faces.
 */

import { describe, expect, it } from 'vitest';

import {
  fontFamily,
  metadataSize,
  metadataText,
  scriptureSize,
  scriptureText,
  uiSize,
  uiText,
} from './typography';

/** The reading steps §3 constrains to 19-21 pt. `title` and `display` are not scripture. */
const READING_STEPS = ['sm', 'md', 'lg'] as const;

describe('scriptureText', () => {
  it('defaults to 20 pt regular, the middle of the 19-21 pt reading range', () => {
    expect(scriptureText()).toEqual({
      fontFamily: 'SourceSerif4-Regular',
      fontSize: 20,
      fontWeight: '400',
      lineHeight: 32,
      letterSpacing: 0,
    });
  });

  it.each(READING_STEPS)('keeps the %s reading step inside 19-21 pt', (step) => {
    const { fontSize } = scriptureText(step);

    expect(fontSize).toBeGreaterThanOrEqual(19);
    expect(fontSize).toBeLessThanOrEqual(21);
  });

  it.each(Object.keys(scriptureSize) as (keyof typeof scriptureSize)[])(
    'gives the %s step a line-height of about 1.6x its size',
    (step) => {
      const { fontSize, lineHeight } = scriptureText(step);

      expect(lineHeight / fontSize).toBeCloseTo(1.6, 1);
    },
  );

  it('never tracks scripture', () => {
    expect(scriptureText('lg').letterSpacing).toBe(0);
  });

  it('reaches the semi-bold serif face by name, not by weight alone', () => {
    const emphasis = scriptureText('md', 'semiBold');

    expect(emphasis.fontFamily).toBe('SourceSerif4-SemiBold');
    expect(emphasis.fontWeight).toBe('600');
  });

  it('is the only factory that returns the serif', () => {
    expect(uiText().fontFamily).not.toContain('Serif');
    expect(metadataText().fontFamily).not.toContain('Serif');
  });
});

describe('uiText', () => {
  it('defaults to 15 pt regular sans', () => {
    expect(uiText()).toEqual({
      fontFamily: 'Inter-Regular',
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 21,
      letterSpacing: 0,
    });
  });

  it.each(Object.keys(uiSize) as (keyof typeof uiSize)[])(
    'gives the %s step a line-height of about 1.4x its size',
    (step) => {
      const { fontSize, lineHeight } = uiText(step);

      expect(lineHeight / fontSize).toBeCloseTo(1.4, 1);
    },
  );

  it('maps each named weight to its own registered face', () => {
    expect(uiText('md', 'medium').fontFamily).toBe('Inter-Medium');
    expect(uiText('md', 'semiBold').fontFamily).toBe('Inter-SemiBold');
    expect(uiText('md', 'bold').fontFamily).toBe('Inter-Bold');
  });

  it('rises monotonically through the scale', () => {
    const sizes = Object.values(uiSize);
    const ascending = [...sizes].sort((left, right) => left - right);

    expect(sizes).toEqual(ascending);
  });
});

describe('metadataText', () => {
  it('defaults to 10 pt medium mono, uppercase and tracked', () => {
    expect(metadataText()).toEqual({
      fontFamily: 'JetBrainsMono-Medium',
      fontSize: 10,
      fontWeight: '500',
      lineHeight: 13,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    });
  });

  it.each(Object.keys(metadataSize) as (keyof typeof metadataSize)[])(
    'keeps the %s step inside 9-11 pt and tracked between .14em and .18em',
    (step) => {
      const { fontSize, letterSpacing } = metadataText(step);

      expect(fontSize).toBeGreaterThanOrEqual(9);
      expect(fontSize).toBeLessThanOrEqual(11);
      expect(letterSpacing / fontSize).toBeGreaterThanOrEqual(0.14);
      expect(letterSpacing / fontSize).toBeLessThanOrEqual(0.18);
    },
  );

  it('is always uppercase, whatever the step or weight', () => {
    expect(metadataText('xs', 'bold').textTransform).toBe('uppercase');
    expect(metadataText('md').textTransform).toBe('uppercase');
  });
});

describe('registered families', () => {
  it('names one face per family-and-weight pair, with no blanks', () => {
    const faces = [
      ...Object.values(fontFamily.scripture),
      ...Object.values(fontFamily.ui),
      ...Object.values(fontFamily.metadata),
    ];

    expect(faces).toHaveLength(8);
    expect(new Set(faces).size).toBe(faces.length);
    for (const face of faces) {
      expect(face.length).toBeGreaterThan(0);
    }
  });

  it('keeps the three families genuinely separate', () => {
    const serif = new Set<string>(Object.values(fontFamily.scripture));
    const sans = new Set<string>(Object.values(fontFamily.ui));
    const mono = new Set<string>(Object.values(fontFamily.metadata));

    expect([...serif].some((face) => sans.has(face) || mono.has(face))).toBe(false);
    expect([...sans].some((face) => mono.has(face))).toBe(false);
  });
});

describe('factory purity', () => {
  it('returns an equal style for equal arguments', () => {
    expect(scriptureText('md')).toEqual(scriptureText('md'));
    expect(uiText('lg', 'bold')).toEqual(uiText('lg', 'bold'));
  });

  it('produces whole-point line-heights, which is what React Native measures in', () => {
    expect(Number.isInteger(scriptureText('sm').lineHeight)).toBe(true);
    expect(Number.isInteger(uiText('xs').lineHeight)).toBe(true);
    expect(Number.isInteger(metadataText('md').lineHeight)).toBe(true);
  });
});
