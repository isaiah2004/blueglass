/**
 * Tests for splicing inline badges into a verse.
 *
 * The load-bearing assertion is the round trip: concatenating the text-carrying segments
 * must reproduce the verse character for character. Scripture that a renderer silently
 * edits is the worst bug this feature could ship.
 */

import { describe, expect, it } from 'vitest';

import { segmentVerse, type VerseSegment } from './verse-badges';

const VERSE =
  'Setting sail therefore from Troas, we made a straight course to Samothrace, and the day following to Neapolis.';

/**
 * The scripture a segment run would render.
 *
 * @param segments - The run to flatten.
 * @returns Every text and word segment concatenated. Side effects: none.
 */
function renderedText(segments: readonly VerseSegment[]): string {
  return segments.map((segment) => (segment.type === 'badge' ? '' : segment.text)).join('');
}

describe('segmentVerse', () => {
  it('returns the verse unsplit when there are no anchors', () => {
    expect(segmentVerse(VERSE)).toEqual([{ type: 'text', text: VERSE }]);
  });

  it('places the badge immediately after the tinted word', () => {
    const segments = segmentVerse(VERSE, [{ kind: 'route', word: 'Troas' }]);
    const kinds = segments.map((segment) => segment.type);
    expect(kinds).toEqual(['text', 'word', 'badge', 'text']);
    expect(segments[1]).toMatchObject({ type: 'word', text: 'Troas', kind: 'route' });
    expect(renderedText(segments)).toBe(VERSE);
  });

  it('preserves the verse exactly, for every anchor arrangement', () => {
    const arrangements = [
      [{ kind: 'route' as const, word: 'Troas' }],
      [
        { kind: 'route' as const, word: 'Troas' },
        { kind: 'city3d' as const, word: 'Neapolis' },
      ],
      [{ kind: 'history' as const, word: 'Setting' }],
      [{ kind: 'history' as const, word: 'Neapolis.' }],
    ];
    for (const anchors of arrangements) {
      expect(renderedText(segmentVerse(VERSE, anchors))).toBe(VERSE);
    }
  });

  it('keeps anchors in reading order however they were supplied', () => {
    const segments = segmentVerse(VERSE, [
      { kind: 'city3d', word: 'Neapolis' },
      { kind: 'route', word: 'Troas' },
    ]);
    const badges = segments.filter((segment) => segment.type === 'badge');
    expect(badges.map((badge) => badge.kind)).toEqual(['route', 'city3d']);
  });

  it('annotates the requested occurrence, not merely the first', () => {
    const text = 'Jesus said to Jesus.';
    const segments = segmentVerse(text, [{ kind: 'root', word: 'Jesus', occurrence: 2 }]);
    expect(segments[0]).toEqual({ type: 'text', text: 'Jesus said to ' });
    expect(segments[1]).toMatchObject({ type: 'word', text: 'Jesus' });
    expect(renderedText(segments)).toBe(text);
  });

  it('drops an anchor whose word is not in the verse rather than failing to render', () => {
    const segments = segmentVerse(VERSE, [{ kind: 'route', word: 'Antioch' }]);
    expect(segments).toEqual([{ type: 'text', text: VERSE }]);
  });

  it.each([0, 3, 9])('drops an anchor asking for occurrence %i', (occurrence) => {
    const segments = segmentVerse(VERSE, [{ kind: 'route', word: 'Troas', occurrence }]);
    expect(renderedText(segments)).toBe(VERSE);
    expect(segments.filter((segment) => segment.type === 'badge')).toHaveLength(0);
  });

  it('drops an empty anchor word', () => {
    expect(segmentVerse(VERSE, [{ kind: 'route', word: '' }])).toHaveLength(1);
  });

  it('drops the second of two overlapping anchors', () => {
    const segments = segmentVerse('a straight course', [
      { kind: 'route', word: 'straight course' },
      { kind: 'history', word: 'course' },
    ]);
    expect(segments.filter((segment) => segment.type === 'badge')).toHaveLength(1);
    expect(renderedText(segments)).toBe('a straight course');
  });

  it('handles a badge at the very start and at the very end', () => {
    const start = segmentVerse(VERSE, [{ kind: 'history', word: 'Setting' }]);
    expect(start[0]).toMatchObject({ type: 'word', text: 'Setting' });

    const end = segmentVerse(VERSE, [{ kind: 'city3d', word: 'Neapolis.' }]);
    expect(end.at(-1)).toMatchObject({ type: 'badge' });
  });

  it('gives every badge in a verse a distinct key', () => {
    const segments = segmentVerse(VERSE, [
      { kind: 'route', word: 'Troas' },
      { kind: 'route', word: 'Samothrace' },
    ]);
    const ids = segments.filter((segment) => segment.type === 'badge').map((badge) => badge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries a custom label through to the pill', () => {
    const segments = segmentVerse(VERSE, [{ kind: 'route', word: 'Troas', label: 'Voyage' }]);
    expect(segments.find((segment) => segment.type === 'badge')?.label).toBe('Voyage');
  });
});

describe('segmentVerse — the server-supplied offset', () => {
  const SECOND_TROAS_VERSE = 'From Troas to Philippi, and from Philippi back to Troas.';

  it('uses the offset when it still lands on the anchored word', () => {
    const segments = segmentVerse(SECOND_TROAS_VERSE, [
      { kind: 'route', word: 'Troas', startOffset: 50 },
    ]);
    const before = segments.filter((segment) => segment.type === 'text')[0];

    // The offset picks the SECOND Troas, which no occurrence-1 search would have found.
    expect(before?.type === 'text' && before.text).toBe(
      'From Troas to Philippi, and from Philippi back to ',
    );
  });

  it('falls back to the occurrence search when the offset has drifted', () => {
    // The same badge against a different translation's wording: the offset now points at
    // whitespace, so the anchor is located by its word instead of being dropped.
    const segments = segmentVerse(SECOND_TROAS_VERSE, [
      { kind: 'route', word: 'Troas', startOffset: 4 },
    ]);
    const word = segments.find((segment) => segment.type === 'word');

    expect(word).toMatchObject({ type: 'word', text: 'Troas' });
    expect(renderedText(segments)).toBe(SECOND_TROAS_VERSE);
  });

  it('drops an anchor whose word is absent however good its offset looks', () => {
    expect(
      segmentVerse(SECOND_TROAS_VERSE, [{ kind: 'route', word: 'Antioch', startOffset: 5 }]),
    ).toEqual([{ type: 'text', text: SECOND_TROAS_VERSE }]);
  });

  it('never edits the verse, whichever way the anchor resolved', () => {
    const withOffset = segmentVerse(SECOND_TROAS_VERSE, [
      { kind: 'route', word: 'Troas', startOffset: 50 },
    ]);
    expect(renderedText(withOffset)).toBe(SECOND_TROAS_VERSE);
  });

  it('uses the badge id as the segment key so a tap can find its badge', () => {
    const segments = segmentVerse(VERSE, [
      { kind: 'route', word: 'Troas', startOffset: 28, badgeId: 'route~44016011~x' },
    ]);
    const badge = segments.find((segment) => segment.type === 'badge');

    expect(badge).toMatchObject({ id: 'route~44016011~x', badgeId: 'route~44016011~x' });
  });

  it('leaves badgeId undefined for a decorative pill', () => {
    const segments = segmentVerse(VERSE, [{ kind: 'route', word: 'Troas' }]);
    const badge = segments.find((segment) => segment.type === 'badge');

    expect(badge?.type === 'badge' && badge.badgeId).toBeUndefined();
  });
});
