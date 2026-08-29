/**
 * Tests for the `[Root]` sheet's usage copy.
 *
 * What is worth asserting here
 *   Every sentence this module produces is a factual claim about the corpus, and pillar 3
 *   says a claim the data does not support is not rendered. The two that could go wrong
 *   quietly are the singular/plural agreement — "1 Occurrences" is the classic tell of a
 *   number nobody checked — and the corpus name, which must not widen a Greek New Testament
 *   count into a claim about the whole Bible.
 */

import { describe, expect, it } from 'vitest';

import type { RootSheetPayload } from '../model/textual-payloads';
import {
  corpusLabel,
  examplesCaption,
  headlineSummary,
  isSingleOccurrence,
  rarityNote,
  usageStats,
} from './root-usage';

/**
 * A payload with the shape the API returns, defaults taken from Acts 16:14.
 *
 * @param overrides - Fields to replace.
 * @returns The payload. Side effects: none.
 */
function payload(overrides: Partial<RootSheetPayload> = {}): RootSheetPayload {
  return {
    lemma: 'πορφυρόπωλις',
    language: 'greek',
    transliteration: 'porphuropōlis',
    strongsNumber: 'G4211',
    gloss: 'dealer in purple',
    surface: 'πορφυρόπωλις',
    occurrenceCount: 1,
    verseCount: 1,
    bookCount: 1,
    definition: 'a female seller of purple cloth.',
    ...overrides,
  };
}

describe('corpusLabel', () => {
  it('does not widen a Greek count into a claim about the whole Bible', () => {
    expect(corpusLabel('greek')).toBe('the Greek New Testament');
  });

  it('names the Hebrew and Aramaic corpora separately', () => {
    expect(corpusLabel('hebrew')).toBe('the Hebrew Bible');
    expect(corpusLabel('aramaic')).toBe('the Aramaic portions of the Old Testament');
  });
});

describe('usageStats', () => {
  it('uses singular captions for a word that occurs once', () => {
    expect(usageStats(payload())).toEqual([
      { value: '1', caption: 'Use' },
      { value: '1', caption: 'Verse' },
      { value: '1', caption: 'Book' },
    ]);
  });

  it('uses plural captions for a word that occurs more than once', () => {
    const stats = usageStats(payload({ occurrenceCount: 7, verseCount: 6, bookCount: 3 }));

    expect(stats.map((stat) => stat.caption)).toEqual(['Uses', 'Verses', 'Books']);
    expect(stats.map((stat) => stat.value)).toEqual(['7', '6', '3']);
  });

  it('offers three cells, not the mockups four, because the fourth has no data', () => {
    expect(usageStats(payload())).toHaveLength(3);
  });
});

describe('isSingleOccurrence', () => {
  it('recognises a hapax legomenon', () => {
    expect(isSingleOccurrence(payload())).toBe(true);
    expect(isSingleOccurrence(payload({ occurrenceCount: 2 }))).toBe(false);
  });
});

describe('rarityNote', () => {
  it('leads with the hapax, which is the most interesting true thing', () => {
    expect(rarityNote(payload())).toBe(
      'This word occurs once in the whole of the Greek New Testament.',
    );
  });

  it('counts occurrences, verses and books for a commoner word', () => {
    expect(rarityNote(payload({ occurrenceCount: 9, verseCount: 8, bookCount: 1 }))).toBe(
      'It occurs 9 times in the Greek New Testament, across 8 verses in 1 book.',
    );
  });
});

describe('examplesCaption', () => {
  it('says plainly when the verse on screen is the only occurrence', () => {
    expect(examplesCaption(payload())).toBe('The verse you are reading is its only occurrence.');
  });

  it('counts the others without promising a list it cannot serve', () => {
    expect(examplesCaption(payload({ verseCount: 4 }))).toBe(
      'The verse you are reading, and 3 other verses.',
    );
  });

  it('agrees in number when there is exactly one other verse', () => {
    expect(examplesCaption(payload({ verseCount: 2 }))).toBe(
      'The verse you are reading, and 1 other verse.',
    );
  });
});

describe('headlineSummary', () => {
  it('is silent when the gloss only repeats the word the reader tapped', () => {
    expect(headlineSummary(payload(), 'dealer in purple')).toBeUndefined();
    expect(headlineSummary(payload(), 'Dealer in Purple')).toBeUndefined();
  });

  it('offers the gloss when it says something the headline did not', () => {
    expect(headlineSummary(payload({ gloss: 'a seller of purple cloth' }), 'purple')).toBe(
      'a seller of purple cloth',
    );
  });
});
