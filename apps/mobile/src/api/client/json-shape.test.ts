/**
 * Tests for the response decoders.
 *
 * What these prove
 *   - Each primitive accepts only its own JSON type.
 *   - A failure names the exact path, so a contract drift is one grep away rather than
 *     an `undefined` discovered three screens later.
 *   - Nested arrays and objects thread the path correctly, including the index.
 *   - Nothing throws: a decoder given garbage returns a failure like any other.
 */

import { describe, expect, it } from 'vitest';

import {
  decodeArray,
  decodeBoolean,
  decodeNullable,
  decodeNumber,
  decodeObject,
  decodeRecord,
  decodeString,
  type DecodeFailure,
} from './json-shape';

/** Read the failure arm without a cast at every assertion. */
function failureOf(result: unknown): DecodeFailure {
  return (result as { error: DecodeFailure }).error;
}

describe('primitive decoders', () => {
  it('accepts the right type and rejects the rest', () => {
    expect(decodeString('psalm', 'p')).toEqual({ ok: true, value: 'psalm' });
    expect(decodeNumber(23, 'p')).toEqual({ ok: true, value: 23 });
    expect(decodeBoolean(false, 'p')).toEqual({ ok: true, value: false });

    expect(decodeString(23, 'p').ok).toBe(false);
    expect(decodeNumber('23', 'p').ok).toBe(false);
    expect(decodeBoolean(1, 'p').ok).toBe(false);
  });

  it('rejects NaN and Infinity, neither of which survives JSON', () => {
    expect(decodeNumber(Number.NaN, 'p').ok).toBe(false);
    expect(decodeNumber(Number.POSITIVE_INFINITY, 'p').ok).toBe(false);
  });

  it('names the path and what it wanted', () => {
    expect(failureOf(decodeNumber('x', 'chapter.verses[3].verse_key'))).toEqual({
      path: 'chapter.verses[3].verse_key',
      expected: 'a number',
    });
  });

  it('rejects null and arrays as objects, since neither is what an endpoint means', () => {
    expect(decodeRecord(null, 'p').ok).toBe(false);
    expect(decodeRecord([], 'p').ok).toBe(false);
    expect(decodeRecord({ a: 1 }, 'p').ok).toBe(true);
  });
});

describe('decodeNullable', () => {
  it('treats null and undefined alike as absent', () => {
    const decode = decodeNullable(decodeString);

    expect(decode(null, 'p')).toEqual({ ok: true, value: null });
    expect(decode(undefined, 'p')).toEqual({ ok: true, value: null });
    expect(decode('here', 'p')).toEqual({ ok: true, value: 'here' });
  });
});

describe('decodeArray', () => {
  it('decodes each element', () => {
    expect(decodeArray(decodeNumber)([1, 2, 3], 'keys')).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('stops at the first bad element and reports its index', () => {
    const result = decodeArray(decodeNumber)([1, 'two', 3], 'keys');

    expect(failureOf(result)).toEqual({ path: 'keys[1]', expected: 'a number' });
  });

  it('rejects a non-array', () => {
    expect(failureOf(decodeArray(decodeNumber)({}, 'keys')).expected).toBe('an array');
  });

  it('accepts an empty array — an empty search result is not a failure', () => {
    expect(decodeArray(decodeNumber)([], 'keys')).toEqual({ ok: true, value: [] });
  });
});

describe('decodeObject', () => {
  const decodeVerse = decodeObject<{ verse: number; text: string }>({
    verse: decodeNumber,
    text: decodeString,
  });

  it('decodes every declared field', () => {
    expect(decodeVerse({ verse: 16, text: 'For God so loved' }, 'v')).toEqual({
      ok: true,
      value: { verse: 16, text: 'For God so loved' },
    });
  });

  it('ignores fields it was not told about, so the API may add one', () => {
    const result = decodeVerse({ verse: 16, text: 'x', osis_id: 'John.3.16' }, 'v');

    expect(result).toEqual({ ok: true, value: { verse: 16, text: 'x' } });
  });

  it('fails when a declared field is missing, naming it', () => {
    expect(failureOf(decodeVerse({ verse: 16 }, 'v'))).toEqual({
      path: 'v.text',
      expected: 'a string',
    });
  });

  it('omits the dot when decoding from the root', () => {
    expect(failureOf(decodeVerse({ verse: 16 }, '')).path).toBe('text');
  });

  it('threads the path through a nested structure', () => {
    const decodeChapter = decodeObject<{ verses: readonly { verse: number; text: string }[] }>({
      verses: decodeArray(decodeVerse),
    });

    const result = decodeChapter({ verses: [{ verse: 1, text: 'a' }, { verse: 2 }] }, '');

    expect(failureOf(result).path).toBe('verses[1].text');
  });
});
