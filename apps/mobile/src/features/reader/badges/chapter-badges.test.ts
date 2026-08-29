/**
 * The density rule that protects the reading rhythm.
 *
 * What is worth asserting here
 *   Pillar 1 says the reading canvas stays pristine. The one thing that can quietly destroy
 *   it is badge density: the data justifies a pill on nearly every verse of Acts 16, and
 *   rendering them all would satisfy pillar 2 while ruining pillar 1. The cap is therefore a
 *   product decision, and a product decision that is only enforced by a server nobody here
 *   controls is not enforced.
 *
 * The fixture is real
 *   Its two badges on Acts 16:1 are the server's own choice of what to show together, so the
 *   ordering assertions below are about the reader honouring that order rather than inventing
 *   one.
 */

import { describe, expect, it } from 'vitest';

import { decodeChapterBadges } from './badge-decoders';
import type { ReaderBadge } from './badge-models';
import { anchorsByVerseKey, badgesById, inlineBadgeCount } from './chapter-badges';
import { ACTS_16_BADGES } from './testing/badge-fixtures';

/** The fixture's badges, decoded. */
function fixtureBadges(): readonly ReaderBadge[] {
  const decoded = decodeChapterBadges(ACTS_16_BADGES, '');
  if (!decoded.ok) throw new Error('the Acts 16 fixture did not decode');
  return decoded.value.badges;
}

/** The same badge repeated onto one verse, to push past the cap. */
function crowd(count: number): readonly ReaderBadge[] {
  const [first] = fixtureBadges();
  if (first === undefined) throw new Error('the fixture is empty');
  return Array.from({ length: count }, (_unused, index) => ({
    ...first,
    id: `${first.id}#${String(index)}`,
  }));
}

describe('anchorsByVerseKey', () => {
  it('indexes badges by the packed verse key their anchor names', () => {
    const anchors = anchorsByVerseKey(fixtureBadges());

    expect([...anchors.keys()].sort()).toEqual([44016001, 44016006, 44016011, 44016015]);
  });

  it('carries the offset and the badge id through to the segmenter', () => {
    const anchors = anchorsByVerseKey(fixtureBadges());
    const first = anchors.get(44016001)?.[0];

    expect(first?.word).toBe('Derbe');
    expect(first?.startOffset).toBe(13);
    expect(first?.kind).toBe('route');
    expect(first?.badgeId).toMatch(/^route~44016001~/);
  });

  it('translates the wire kind into the theme kind that owns the hue', () => {
    const anchors = anchorsByVerseKey(fixtureBadges());
    const kinds = [...anchors.values()].flat().map((anchor) => anchor.kind);

    expect(kinds).toContain('city3d');
    expect(kinds).not.toContain('3d-city');
  });

  it('caps a verse at two pills however many the server sends', () => {
    const anchors = anchorsByVerseKey(crowd(6));

    expect(anchors.get(44016001)).toHaveLength(2);
    expect(inlineBadgeCount(anchors)).toBe(2);
  });

  it('keeps the first badges the server listed, not an arbitrary pair', () => {
    const anchors = anchorsByVerseKey(crowd(6));
    const ids = anchors.get(44016001)?.map((anchor) => anchor.badgeId);

    expect(ids?.[0]).toMatch(/#0$/);
    expect(ids?.[1]).toMatch(/#1$/);
  });

  it('honours a caller that asks for a different ceiling', () => {
    expect(anchorsByVerseKey(crowd(6), 1).get(44016001)).toHaveLength(1);
  });

  it('returns the shared empty map for a chapter with no enrichment', () => {
    expect(anchorsByVerseKey([]).size).toBe(0);
    expect(inlineBadgeCount(anchorsByVerseKey([]))).toBe(0);
  });
});

describe('badgesById', () => {
  it('finds every badge the chapter delivered, including the ones the cap hid', () => {
    const badges = fixtureBadges();
    const byId = badgesById(badges);

    expect(byId.size).toBe(badges.length);
    for (const badge of badges) {
      expect(byId.get(badge.id)).toBe(badge);
    }
  });

  it('answers undefined for an id from another chapter', () => {
    expect(badgesById(fixtureBadges()).get('route~44017001~x')).toBeUndefined();
  });
});
