/**
 * Edge-case tests for book resolution.
 *
 * Purpose
 *   `books.data.test.ts` proves the whole canon round-trips. This file covers the
 *   specific spellings and out-of-range values that broke the Flutter prototype or that
 *   the API's alias table treats specially, each as its own named test.
 *
 * Why these cases
 *   `1 John` / `1John` / `1jn` — three spellings a reader, a deep link, and an AI
 *   citation each produce for the same book. `Psalm` / `Psalms` — the one book whose
 *   singular is more common than its canonical plural. Book `0` — the exact value the
 *   Flutter client persists when its lookup misses. Book `67` — the other end of the
 *   same off-by-one.
 */

import { describe, expect, it } from 'vitest';

import { unwrapError, unwrapValue } from '../testing/unwrap-result';
import { bookFromAny, bookFromNumber, bookNumberFromAny } from './book-lookup';

/** Canon positions used by name in the assertions below. */
const FIRST_JOHN = 62;
const PSALMS = 19;
const PHILIPPIANS = 50;
const PHILEMON = 57;

describe('spellings of the same book', () => {
  it('resolves "1 John" with a space', () => {
    expect(unwrapValue(bookNumberFromAny('1 John'))).toBe(FIRST_JOHN);
  });

  it('resolves "1John" run together, the OSIS spelling', () => {
    expect(unwrapValue(bookNumberFromAny('1John'))).toBe(FIRST_JOHN);
  });

  it('resolves "1jn", the abbreviation the API\'s own alias table omits', () => {
    expect(unwrapValue(bookNumberFromAny('1jn'))).toBe(FIRST_JOHN);
  });

  it('resolves "1-john", the route slug', () => {
    expect(unwrapValue(bookNumberFromAny('1-john'))).toBe(FIRST_JOHN);
  });

  it('keeps 1, 2, and 3 John distinct', () => {
    expect(unwrapValue(bookNumberFromAny('2jn'))).toBe(63);
    expect(unwrapValue(bookNumberFromAny('3jn'))).toBe(64);
  });

  it('resolves "Psalm" singular to Psalms', () => {
    expect(unwrapValue(bookNumberFromAny('Psalm'))).toBe(PSALMS);
  });

  it('resolves "Psalms" plural, the canonical name', () => {
    expect(unwrapValue(bookNumberFromAny('Psalms'))).toBe(PSALMS);
  });

  it('resolves "Ps", the OSIS code, and "psa"', () => {
    expect(unwrapValue(bookNumberFromAny('Ps'))).toBe(PSALMS);
    expect(unwrapValue(bookNumberFromAny('psa'))).toBe(PSALMS);
  });

  it('resolves "Song of Songs" and "Canticles" to Song of Solomon', () => {
    expect(unwrapValue(bookNumberFromAny('Song of Songs'))).toBe(22);
    expect(unwrapValue(bookNumberFromAny('Canticles'))).toBe(22);
  });

  it('does not confuse Philippians with Philemon', () => {
    expect(unwrapValue(bookNumberFromAny('Phil'))).toBe(PHILIPPIANS);
    expect(unwrapValue(bookNumberFromAny('phi'))).toBe(PHILIPPIANS);
    expect(unwrapValue(bookNumberFromAny('Phlm'))).toBe(PHILEMON);
    expect(unwrapValue(bookNumberFromAny('phm'))).toBe(PHILEMON);
  });

  it('resolves the abbreviations the API accepts on /read/{book}/{chapter}', () => {
    expect(unwrapValue(bookNumberFromAny('prov'))).toBe(20);
    expect(unwrapValue(bookNumberFromAny('1cor'))).toBe(46);
    expect(unwrapValue(bookNumberFromAny('sos'))).toBe(22);
    expect(unwrapValue(bookNumberFromAny('matt'))).toBe(40);
  });
});

describe('book numbers outside the canon', () => {
  it('rejects book 0 — the value the Flutter client silently persists', () => {
    const error = unwrapError(bookFromNumber(0));

    expect(error.code).toBe('BOOK_NUMBER_OUT_OF_RANGE');
    expect(error.input).toBe('0');
  });

  it('rejects book 67, one past Revelation', () => {
    expect(unwrapError(bookFromNumber(67)).code).toBe('BOOK_NUMBER_OUT_OF_RANGE');
  });

  it('rejects a negative book number', () => {
    expect(unwrapError(bookFromNumber(-1)).code).toBe('BOOK_NUMBER_OUT_OF_RANGE');
  });

  it('rejects a fractional book number', () => {
    expect(unwrapError(bookFromNumber(43.5)).code).toBe('BOOK_NUMBER_OUT_OF_RANGE');
  });

  it('rejects "0" and "67" arriving as route params', () => {
    expect(unwrapError(bookFromAny('0')).code).toBe('BOOK_NUMBER_OUT_OF_RANGE');
    expect(unwrapError(bookFromAny('67')).code).toBe('BOOK_NUMBER_OUT_OF_RANGE');
  });

  it('accepts the two ends of the canon as numbers', () => {
    expect(unwrapValue(bookFromNumber(1)).name).toBe('Genesis');
    expect(unwrapValue(bookFromNumber(66)).name).toBe('Revelation');
  });
});

describe('input that names no book', () => {
  it('rejects an empty string as malformed rather than unknown', () => {
    expect(unwrapError(bookFromAny('')).code).toBe('MALFORMED_REFERENCE');
  });

  it('rejects whitespace and punctuation only', () => {
    expect(unwrapError(bookFromAny('  ... ')).code).toBe('MALFORMED_REFERENCE');
  });

  it('rejects a word that is not a book, and echoes it back', () => {
    const error = unwrapError(bookFromAny('Hezekiah'));

    expect(error.code).toBe('UNKNOWN_BOOK');
    expect(error.input).toBe('Hezekiah');
  });

  it('does not prefix-match, so an ambiguous stem stays unknown', () => {
    expect(unwrapError(bookFromAny('j')).code).toBe('UNKNOWN_BOOK');
  });
});
