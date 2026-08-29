/**
 * Tests for the development badge preview.
 *
 * Small, but the two properties matter: it places at most ONE badge, and it places none at
 * all when nothing matches. Both are what stop a development affordance from turning into
 * a content source — `flutter-port-map.md` risk #11.
 */

import { describe, expect, it } from 'vitest';

import { previewAnchors, PREVIEW_WORDS, type PreviewVerse } from './badge-preview';

const ACTS_16: readonly PreviewVerse[] = [
  { verse: 1, text: 'Paul came to Derbe and then to Lystra.' },
  { verse: 4, text: 'the apostles and elders in Jerusalem for the people to obey.' },
  { verse: 8, text: 'So they passed by Mysia and went down to Troas.' },
  { verse: 12, text: 'From there we went to the Roman colony of Philippi.' },
];

describe('previewAnchors', () => {
  it('places exactly one badge, however many verses match', () => {
    const anchors = previewAnchors(ACTS_16);
    expect(anchors.size).toBe(1);
  });

  it('places it on the first matching verse, in reading order', () => {
    const anchors = previewAnchors(ACTS_16);
    expect([...anchors.keys()]).toEqual([4]);
    expect(anchors.get(4)).toEqual([{ kind: 'route', word: 'Jerusalem' }]);
  });

  it('places nothing in a chapter that mentions no preview word', () => {
    const anchors = previewAnchors([{ verse: 1, text: 'In the beginning God created.' }]);
    expect(anchors.size).toBe(0);
  });

  it('places nothing in an empty chapter', () => {
    expect(previewAnchors([]).size).toBe(0);
  });

  it('only ever emits the route kind', () => {
    for (const word of PREVIEW_WORDS) {
      const anchors = previewAnchors([{ verse: 1, text: `They went to ${word} that day.` }]);
      expect(anchors.get(1)?.[0]?.kind).toBe('route');
    }
  });

  it('keeps the word list short enough that nobody mistakes it for data', () => {
    expect(PREVIEW_WORDS.length).toBeLessThanOrEqual(10);
  });
});
