/**
 * Tests for cross-reference ranking.
 *
 * What is worth asserting here
 *   The ranking IS the product: 344,799 links with no ordering are a phone book, and the
 *   vote count is the only thing that turns them into a reading path. A sort that is not
 *   total reorders itself between renders, which reads to a user as the list shuffling under
 *   their thumb — so the tie-break is pinned, not just the primary key.
 */

import { describe, expect, it } from 'vitest';

import { verseKeyFromNumber, type CrossReferenceTarget, type VerseKey } from '@atlas/shared';

import {
  VOTE_CEILING,
  rankedTargets,
  relationCaption,
  relationTitle,
  strengthLabel,
  strengthRatio,
  targetNote,
  votesLabel,
} from './crossref-targets';

/**
 * Decode a packed verse key, failing the test if the fixture is wrong.
 *
 * @param value - The packed integer.
 * @returns The key. Side effects: throws on a bad fixture.
 */
function key(value: number): VerseKey {
  const result = verseKeyFromNumber(value);
  if (!result.ok) {
    throw new Error(`Bad fixture verse key ${String(value)}`);
  }

  return result.value;
}

/**
 * One linked passage.
 *
 * @param votes - Its vote count.
 * @param startKey - Packed key of its first verse.
 * @param endKey - Packed key of its last verse. Defaults to `startKey`.
 * @returns The target. Side effects: none.
 */
function target(votes: number, startKey: number, endKey = startKey): CrossReferenceTarget {
  return {
    range: { start: key(startKey), end: key(endKey) },
    displayReference: 'Acts 2:38-39',
    votes,
  };
}

describe('strengthRatio', () => {
  it('saturates at the ceiling the server ranks against', () => {
    expect(strengthRatio(VOTE_CEILING)).toBe(1);
    expect(strengthRatio(43)).toBe(1);
  });

  it('is proportional below the ceiling', () => {
    expect(strengthRatio(20)).toBeCloseTo(0.5);
  });

  it('is zero for a link with no votes', () => {
    expect(strengthRatio(0)).toBe(0);
    expect(strengthRatio(-3)).toBe(0);
  });
});

describe('strengthLabel', () => {
  it.each([
    [43, 'Strong consensus'],
    [30, 'Strong consensus'],
    [29, 'Well attested'],
    [15, 'Well attested'],
    [14, 'Attested'],
    [10, 'Attested'],
  ])('calls %i votes %s', (votes, expected) => {
    expect(strengthLabel(votes)).toBe(expected);
  });
});

describe('votesLabel', () => {
  it('agrees in number', () => {
    expect(votesLabel(1)).toBe('1 vote');
    expect(votesLabel(43)).toBe('43 votes');
  });
});

describe('relationTitle', () => {
  it('titles the neutral relation every M2 badge carries', () => {
    expect(relationTitle('parallel')).toBe('Parallel passages');
  });

  it('has a title for the three relations no dataset distinguishes yet', () => {
    expect([
      relationTitle('quotation'),
      relationTitle('allusion'),
      relationTitle('fulfilment'),
    ]).toEqual(['Quoted here', 'Alluded to here', 'Fulfilled here']);
  });
});

describe('relationCaption', () => {
  it('says out loud that OpenBible records the link and not its reason', () => {
    expect(relationCaption('parallel', 6)).toContain('not the reason for it');
  });

  it('agrees in number', () => {
    expect(relationCaption('quotation', 1)).toContain('1 passage,');
  });
});

describe('targetNote', () => {
  it('is silent for a single verse', () => {
    expect(targetNote(target(43, 43001012))).toBeUndefined();
  });

  it('warns that a span shows only its first verse', () => {
    expect(targetNote(target(39, 44002038, 44002039))).toBe(
      'First verse of Acts 2:38-39. Open it to read the rest.',
    );
  });
});

describe('rankedTargets', () => {
  it('puts the most-voted link first', () => {
    const ranked = rankedTargets([
      target(22, 41016016),
      target(43, 43001012),
      target(39, 44002038),
    ]);

    expect(ranked.map((entry) => entry.votes)).toEqual([43, 39, 22]);
  });

  it('breaks a tie on canonical order, so the sort is total', () => {
    const ranked = rankedTargets([target(20, 44002038), target(20, 41016016)]);

    expect(ranked.map((entry) => entry.range.start.value)).toEqual([41016016, 44002038]);
  });

  it('breaks a further tie on the span end', () => {
    const ranked = rankedTargets([target(20, 44002038, 44002040), target(20, 44002038, 44002039)]);

    expect(ranked.map((entry) => entry.range.end.value)).toEqual([44002039, 44002040]);
  });

  it('does not mutate the payload it was given', () => {
    const targets = [target(22, 41016016), target(43, 43001012)];
    rankedTargets(targets);

    expect(targets.map((entry) => entry.votes)).toEqual([22, 43]);
  });
});
