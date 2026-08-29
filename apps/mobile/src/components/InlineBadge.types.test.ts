/**
 * Tests for the badge mark and the kind tables.
 *
 * Purpose
 *   `design-language.md` §5 makes the brackets part of the mark. Two of the four render
 *   strategies build the mark as one string and two build it as three nodes; if those ever
 *   disagree the strategies stop being comparable, which would silently invalidate the spike.
 *
 * The glyph is no longer in the mark
 *   `Q-021` replaced the spike's colour emoji with a vector path (`./badge-icons`), because
 *   §5 asks for the icon in the badge's hue and an emoji cannot be tinted. The mark is
 *   therefore text only, and the assertion that used to look for the glyph inside it now
 *   checks the seam a renderer draws the glyph into.
 */

import { describe, expect, it } from 'vitest';

import { badgeKinds } from '@/theme';

import { badgeIconPaths } from './badge-icons';
import { badgeLabel, composeBadgeMark, splitBadgeMark } from './InlineBadge.types';

describe('the kind tables', () => {
  it('gives every badge kind a glyph and a label', () => {
    for (const kind of badgeKinds) {
      expect(badgeIconPaths[kind].length).toBeGreaterThan(0);
      expect(badgeLabel[kind].length).toBeGreaterThan(0);
    }
  });

  it('draws every glyph as strokes rather than as a character', () => {
    for (const kind of badgeKinds) {
      for (const path of badgeIconPaths[kind]) {
        expect(path.startsWith('M')).toBe(true);
      }
    }
  });

  it('uses the labels the mockup summary list shows', () => {
    expect(badgeLabel.route).toBe('Route');
    // Q-025: the mark says what the sheet can deliver. There is no 3D model to show and
    // none can be licensed, so promising one in the pill was a promise broken on every tap.
    expect(badgeLabel.city3d).toBe('Site');
    expect(badgeLabel.crossRef).toBe('Cross-Ref');
  });
});

describe('composeBadgeMark', () => {
  it('wraps the mark in the brackets the design language makes part of it', () => {
    const mark = composeBadgeMark('route');
    expect(mark.startsWith('[')).toBe(true);
    expect(mark.endsWith(']')).toBe(true);
    expect(mark).toBe('[Route]');
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

  it('leaves the brackets in their own nodes, so a glyph can sit between them', () => {
    const parts = splitBadgeMark('meditate');
    expect(parts.lead).toBe('[');
    expect(parts.word).toBe('Meditate');
    expect(parts.tail).toBe(']');
  });

  it('carries an override label through unchanged', () => {
    expect(splitBadgeMark('root', 'proseuchomenos').word).toContain('proseuchomenos');
  });
});
