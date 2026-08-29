/**
 * Tests for the badge mark and the kind tables.
 *
 * Purpose
 *   `design-language.md` §5 makes the brackets part of the mark. Two of the four render
 *   strategies build the mark as one string and two build it as three nodes; if those ever
 *   disagree the strategies stop being comparable, which would silently invalidate the spike.
 */

import { describe, expect, it } from 'vitest';

import { badgeKinds } from '@/theme';

import { badgeGlyph, badgeLabel, composeBadgeMark, splitBadgeMark } from './InlineBadge.types';

describe('the kind tables', () => {
  it('gives every badge kind a glyph and a label', () => {
    for (const kind of badgeKinds) {
      expect(badgeGlyph[kind].length).toBeGreaterThan(0);
      expect(badgeLabel[kind].length).toBeGreaterThan(0);
    }
  });

  it('uses the labels the mockup summary list shows', () => {
    expect(badgeLabel.route).toBe('Route');
    expect(badgeLabel.city3d).toBe('3D City');
    expect(badgeLabel.crossRef).toBe('Cross-Ref');
  });
});

describe('composeBadgeMark', () => {
  it('wraps the mark in the brackets the design language makes part of it', () => {
    const mark = composeBadgeMark('route');
    expect(mark.startsWith('[')).toBe(true);
    expect(mark.endsWith(']')).toBe(true);
    expect(mark).toContain(badgeGlyph.route);
    expect(mark).toContain('Route');
  });

  it('honours a caller-supplied label over the default', () => {
    expect(composeBadgeMark('route', 'Egnatia')).toContain('Egnatia');
    expect(composeBadgeMark('route', 'Egnatia')).not.toContain('Route');
  });
});

describe('splitBadgeMark', () => {
  it('produces exactly the same characters as the single-string form, for every kind', () => {
    for (const kind of badgeKinds) {
      const parts = splitBadgeMark(kind);
      expect(`${parts.lead}${parts.word}${parts.tail}`).toBe(composeBadgeMark(kind));
    }
  });

  it('keeps the glyph out of the word part, so the label can be styled on its own', () => {
    const parts = splitBadgeMark('meditate');
    expect(parts.lead).toContain(badgeGlyph.meditate);
    expect(parts.word).not.toContain(badgeGlyph.meditate);
  });

  it('carries an override label through unchanged', () => {
    expect(splitBadgeMark('root', 'proseuchomenos').word).toContain('proseuchomenos');
  });
});
