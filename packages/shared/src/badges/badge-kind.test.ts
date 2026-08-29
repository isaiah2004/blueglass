/**
 * Tests for the inline badge vocabulary.
 *
 * Purpose
 *   The badge list is where the PRD and the design language disagree: the prose says ten
 *   badges, the bullet list contains eleven marks, and `design-language.md` §2 assigns a
 *   hue to ten of them, omitting Lineage. This suite pins the count the code chose, so
 *   the discrepancy cannot be quietly "fixed" in either direction without a failing test
 *   forcing the question to be answered first.
 */

import { describe, expect, it } from 'vitest';

import {
  BADGE_KIND_COUNT,
  BADGE_KIND_DESCRIPTORS,
  BADGE_KINDS,
  describeBadgeKind,
  isBadgeKind,
} from './badge-kind';

/** Eleven, not the PRD prose's ten. See the module docstring for why. */
const EXPECTED_BADGE_KIND_COUNT = 11;

describe('the badge kind vocabulary', () => {
  it('models eleven badges, one per mark the PRD lists', () => {
    expect(BADGE_KIND_COUNT).toBe(EXPECTED_BADGE_KIND_COUNT);
    expect(BADGE_KINDS).toHaveLength(EXPECTED_BADGE_KIND_COUNT);
  });

  it("includes Lineage, which the design language's hue table omits", () => {
    expect(BADGE_KINDS).toContain('lineage');
  });

  it('keeps Route and 3D City separate, though the PRD shares one bullet for them', () => {
    expect(BADGE_KINDS).toContain('route');
    expect(BADGE_KINDS).toContain('3d-city');
  });

  it('describes every kind exactly once', () => {
    expect(BADGE_KIND_DESCRIPTORS).toHaveLength(EXPECTED_BADGE_KIND_COUNT);
    expect(new Set(BADGE_KIND_DESCRIPTORS.map((d) => d.kind)).size).toBe(EXPECTED_BADGE_KIND_COUNT);
  });

  it('gives every kind a label, a glyph, and a placement rule', () => {
    for (const descriptor of BADGE_KIND_DESCRIPTORS) {
      expect(descriptor.label).not.toBe('');
      expect(descriptor.glyph).not.toBe('');
      expect(descriptor.appearsBeside).not.toBe('');
    }
  });

  it('lists descriptors in the PRD order', () => {
    expect(BADGE_KIND_DESCRIPTORS.map((descriptor) => descriptor.kind)).toEqual([...BADGE_KINDS]);
  });

  it('looks a descriptor up by kind', () => {
    expect(describeBadgeKind('root').label).toBe('Root');
    expect(describeBadgeKind('3d-city').label).toBe('Site');
  });
});

describe('narrowing an untrusted kind from a pre-computed record', () => {
  it('accepts every known kind', () => {
    for (const kind of BADGE_KINDS) {
      expect(isBadgeKind(kind)).toBe(true);
    }
  });

  it('rejects a kind that does not exist', () => {
    expect(isBadgeKind('podcast')).toBe(false);
  });

  it('rejects a near miss in casing or spacing', () => {
    expect(isBadgeKind('Route')).toBe(false);
    expect(isBadgeKind('3d city')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isBadgeKind('')).toBe(false);
  });
});
