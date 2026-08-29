/**
 * Tests for reference formatting and navigation targets.
 *
 * What is worth asserting here
 *   The cross-chapter span. `Acts 2:38-39` and `Acts 16:6 – Acts 17:2` take different
 *   branches, and the second is the one a naive formatter gets wrong — it would print
 *   `Acts 16:6-2`, which is not merely ugly but names a different passage. 637 published
 *   cross-reference ranges cross a chapter, so this is a live case, not a hypothetical.
 */

import { describe, expect, it } from 'vitest';

import { verseKeyFromNumber, type VerseKey } from '@atlas/shared';

import {
  decodeVerseKey,
  decodeVerseRange,
  passageLabel,
  rangeTarget,
  spansMultipleVerses,
  verseLabel,
  verseTarget,
} from './verse-target';

/**
 * Decode a packed verse key, failing the test if the fixture itself is wrong.
 *
 * @param value - The packed integer, e.g. `44016014`.
 * @returns The decoded key. Side effects: throws when the value is not a valid key.
 */
function key(value: number): VerseKey {
  const result = verseKeyFromNumber(value);
  if (!result.ok) {
    throw new Error(`Bad fixture verse key ${String(value)}: ${result.error.message}`);
  }

  return result.value;
}

const ACTS_16_14 = key(44016014);
const ACTS_2_38 = key(44002038);
const ACTS_2_39 = key(44002039);
const ACTS_16_6 = key(44016006);
const ACTS_17_2 = key(44017002);

describe('verseLabel', () => {
  it('names a single verse', () => {
    expect(verseLabel(ACTS_16_14)).toBe('Acts 16:14');
  });
});

describe('passageLabel', () => {
  it('collapses a span inside one chapter', () => {
    expect(passageLabel({ start: ACTS_2_38, end: ACTS_2_39 })).toBe('Acts 2:38-39');
  });

  it('collapses a degenerate span to a single verse', () => {
    expect(passageLabel({ start: ACTS_16_14, end: ACTS_16_14 })).toBe('Acts 16:14');
  });

  it('prints both ends when the span leaves its chapter', () => {
    expect(passageLabel({ start: ACTS_16_6, end: ACTS_17_2 })).toBe('Acts 16:6–Acts 17:2');
  });

  it('prints both ends when the span leaves its book', () => {
    expect(passageLabel({ start: ACTS_17_2, end: key(45001001) })).toBe('Acts 17:2–Romans 1:1');
  });
});

describe('verseTarget', () => {
  it('carries the route segments the host needs', () => {
    expect(verseTarget(ACTS_16_14)).toEqual({
      verse: ACTS_16_14,
      bookId: ACTS_16_14.book.id,
      chapter: 16,
      verseNumber: 14,
      label: 'Acts 16:14',
    });
  });

  it('prefers a supplied label over its own', () => {
    expect(verseTarget(ACTS_2_38, 'Acts 2:38-39').label).toBe('Acts 2:38-39');
  });
});

describe('rangeTarget', () => {
  it('opens the first verse of a span', () => {
    const target = rangeTarget({ start: ACTS_2_38, end: ACTS_2_39 }, 'Acts 2:38-39');

    expect(target.verseNumber).toBe(38);
    expect(target.label).toBe('Acts 2:38-39');
  });
});

describe('spansMultipleVerses', () => {
  it('is false for a single verse', () => {
    expect(spansMultipleVerses({ start: ACTS_16_14, end: ACTS_16_14 })).toBe(false);
  });

  it('is true when the span holds more than one verse', () => {
    expect(spansMultipleVerses({ start: ACTS_2_38, end: ACTS_2_39 })).toBe(true);
  });
});

describe('decodeVerseKey', () => {
  it('decodes a packed key the API sent', () => {
    expect(decodeVerseKey(44016014)?.value).toBe(ACTS_16_14.value);
  });

  it('drops a key that names no real verse rather than throwing', () => {
    // Book 0 does not exist; the prototype's book-number bug produced exactly this.
    expect(decodeVerseKey(3016)).toBeUndefined();
  });
});

describe('decodeVerseRange', () => {
  it('decodes both ends', () => {
    expect(decodeVerseRange(44002038, 44002039)).toEqual({ start: ACTS_2_38, end: ACTS_2_39 });
  });

  it('drops the whole span when one end fails, rather than narrowing it', () => {
    expect(decodeVerseRange(44002038, 3016)).toBeUndefined();
  });
});
