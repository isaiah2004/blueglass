/**
 * The wire-to-theme kind mapping.
 *
 * Why this tiny table gets its own test
 *   It is the join between two published vocabularies, and getting it wrong does not crash —
 *   it renders a Cross-Ref badge in the History badge's blue, which reads as a design choice
 *   rather than as a bug. The colour language is how a reader learns the badge types
 *   (`design-language.md` §2), so a silent swap is worse than a missing pill.
 */

import { describe, expect, it } from 'vitest';

import { badgeIconPaths } from '@/components/badge-icons';
import { badgeLabel } from '@/components/InlineBadge.types';
import { colors } from '@/theme';

import { SHIPPED_BADGE_KINDS, themeBadgeKind } from './badge-kinds';
import { READER_BADGE_KINDS } from './badge-vocabularies';

describe('themeBadgeKind', () => {
  it('maps the two kinds whose spellings differ', () => {
    expect(themeBadgeKind('3d-city')).toBe('city3d');
    expect(themeBadgeKind('cross-ref')).toBe('crossRef');
  });

  it('leaves the three that already agree alone', () => {
    expect(themeBadgeKind('route')).toBe('route');
    expect(themeBadgeKind('history')).toBe('history');
    expect(themeBadgeKind('root')).toBe('root');
  });

  it('is total over every kind the wire can send', () => {
    for (const kind of READER_BADGE_KINDS) {
      expect(SHIPPED_BADGE_KINDS).toContain(themeBadgeKind(kind));
    }
  });

  it('never maps two wire kinds onto one hue', () => {
    const mapped = READER_BADGE_KINDS.map(themeBadgeKind);

    expect(new Set(mapped).size).toBe(READER_BADGE_KINDS.length);
  });
});

describe('every shipped kind can actually be drawn', () => {
  it('has a hue, a glyph and a label', () => {
    for (const kind of SHIPPED_BADGE_KINDS) {
      expect(colors.badge[kind].tint).toBeTypeOf('string');
      expect(badgeIconPaths[kind].length).toBeGreaterThan(0);
      expect(badgeLabel[kind]).toBeTypeOf('string');
    }
  });

  it('ships the five decision P-04 names, and no more', () => {
    expect(SHIPPED_BADGE_KINDS).toEqual(['route', 'city3d', 'history', 'root', 'crossRef']);
  });
});
