/**
 * Behaviour tests for the `VerseKey` value object.
 *
 * Purpose
 *   The packed integer is the app's universal verse identity — highlights, notes,
 *   search hits, and cross-references all key off it. A one-digit error here silently
 *   attaches a reader's note to the wrong verse, so the encoding is pinned against the
 *   API's own arithmetic (`server/app/scripture/refs.py:7-19`) and the boundaries are
 *   tested from both sides.
 *
 * Why these cases
 *   `43003016` is the value the port map names explicitly for John 3:16. Book `0` is
 *   what a key of `3016` decodes to — the Flutter corruption seen from the other end.
 *   Psalms 151 and Obadiah 2 are chapter overflow in the longest and shortest books.
 */

import { describe, expect, it } from 'vitest';

import { unwrapError, unwrapValue } from '../testing/unwrap-result';
import { CANONICAL_BOOKS } from './books.data';
import { formatVerseReference } from './format-verse-reference';
import { formatOsisId, makeVerseKey, toVerseReference, verseKeyFromNumber } from './verse-key';

/** The worked example in `docs/architecture/flutter-port-map.md` §7. */
const JOHN_3_16 = 43003016;

describe('packing a verse key', () => {
  it('encodes John 3:16 as the integer the API stores', () => {
    expect(unwrapValue(makeVerseKey('John', 3, 16)).value).toBe(JOHN_3_16);
  });

  it('encodes book, chapter, and verse in their own decimal fields', () => {
    const key = unwrapValue(makeVerseKey('Genesis', 1, 1));

    expect(key.value).toBe(1001001);
  });

  it('carries the resolved book, so a caller can render a name without a second lookup', () => {
    const key = unwrapValue(makeVerseKey('1jn', 4, 9));

    expect(key.book.name).toBe('1 John');
    expect(key.book.canonicalNumber).toBe(62);
    expect(key.value).toBe(62004009);
  });

  it('accepts the longest chapter and verse in the canon, Psalm 119:176', () => {
    expect(unwrapValue(makeVerseKey('Psalms', 119, 176)).value).toBe(19119176);
  });

  it('refuses to build a key for a book that does not exist', () => {
    expect(unwrapError(makeVerseKey('Hezekiah', 1, 1)).code).toBe('UNKNOWN_BOOK');
  });
});

describe('chapter and verse bounds', () => {
  it('rejects Psalms 151 — one past the longest book in the canon', () => {
    const error = unwrapError(makeVerseKey('Psalms', 151, 1));

    expect(error.code).toBe('CHAPTER_OUT_OF_RANGE');
    expect(error.message).toContain('150');
  });

  it('rejects Obadiah 2 — the book has a single chapter', () => {
    expect(unwrapError(makeVerseKey('Obadiah', 2, 1)).code).toBe('CHAPTER_OUT_OF_RANGE');
  });

  it('rejects chapter 0', () => {
    expect(unwrapError(makeVerseKey('John', 0, 1)).code).toBe('CHAPTER_OUT_OF_RANGE');
  });

  it('rejects a fractional chapter', () => {
    expect(unwrapError(makeVerseKey('John', 3.5, 16)).code).toBe('CHAPTER_OUT_OF_RANGE');
  });

  it('rejects verse 0', () => {
    expect(unwrapError(makeVerseKey('John', 3, 0)).code).toBe('VERSE_OUT_OF_RANGE');
  });

  it('rejects verse 1000, which would overflow into the chapter field', () => {
    expect(unwrapError(makeVerseKey('John', 3, 1000)).code).toBe('VERSE_OUT_OF_RANGE');
  });

  it('accepts verse 999, the last value the encoding can hold', () => {
    expect(unwrapValue(makeVerseKey('John', 3, 999)).value).toBe(43003999);
  });
});

describe('unpacking a verse key', () => {
  it('decodes the API integer back into its parts', () => {
    const key = unwrapValue(verseKeyFromNumber(JOHN_3_16));

    expect(key.book.name).toBe('John');
    expect(key.chapter).toBe(3);
    expect(key.verse).toBe(16);
  });

  it('rejects a key whose book field is 0 — the Flutter corruption, seen on read', () => {
    const error = unwrapError(verseKeyFromNumber(3016));

    expect(error.code).toBe('BOOK_NUMBER_OUT_OF_RANGE');
  });

  it('rejects a key whose book field is 67', () => {
    expect(unwrapError(verseKeyFromNumber(67003016)).code).toBe('BOOK_NUMBER_OUT_OF_RANGE');
  });

  it('rejects a key whose chapter field is past the end of the book', () => {
    expect(unwrapError(verseKeyFromNumber(31002001)).code).toBe('CHAPTER_OUT_OF_RANGE');
  });

  it('rejects a negative or fractional key', () => {
    expect(unwrapError(verseKeyFromNumber(-1)).code).toBe('MALFORMED_REFERENCE');
    expect(unwrapError(verseKeyFromNumber(43003016.5)).code).toBe('MALFORMED_REFERENCE');
  });

  it('round-trips the first verse of all 66 books through the integer encoding', () => {
    for (const book of CANONICAL_BOOKS) {
      const packed = unwrapValue(makeVerseKey(book.canonicalNumber, 1, 1));
      const unpacked = unwrapValue(verseKeyFromNumber(packed.value));

      expect(unpacked.book.canonicalNumber).toBe(book.canonicalNumber);
      expect(unpacked.chapter).toBe(1);
      expect(unpacked.verse).toBe(1);
    }
  });

  it('round-trips the last chapter of all 66 books through the integer encoding', () => {
    for (const book of CANONICAL_BOOKS) {
      const packed = unwrapValue(makeVerseKey(book.osis, book.chapterCount, 1));

      expect(unwrapValue(verseKeyFromNumber(packed.value)).chapter).toBe(book.chapterCount);
    }
  });
});

describe('rendering a verse key', () => {
  it('formats the OSIS id the API expects in a path', () => {
    expect(formatOsisId(unwrapValue(makeVerseKey('John', 3, 16)))).toBe('John.3.16');
  });

  it('uses the OSIS code, not the display name, for numbered books', () => {
    expect(formatOsisId(unwrapValue(makeVerseKey('1 John', 4, 9)))).toBe('1John.4.9');
    expect(formatOsisId(unwrapValue(makeVerseKey('Psalm', 23, 1)))).toBe('Ps.23.1');
  });

  it('widens into the reference shape the display formatter takes', () => {
    const reference = toVerseReference(unwrapValue(makeVerseKey('acts', 16, 14)));

    expect(formatVerseReference(reference)).toBe('Acts 16:14');
  });
});
