/**
 * Tests for the reader's address resolution and canon walk.
 *
 * The walk is exhaustive on purpose: `flutter-port-map.md` §8 risk 10 records that the
 * prototype mapped only three of the 66 books, so every book-boundary rollover is
 * asserted here rather than sampled.
 */

import { CANONICAL_BOOKS } from '@atlas/shared';
import { describe, expect, it } from 'vitest';

import {
  nextChapter,
  previousChapter,
  readerPath,
  readerReference,
  resolveReaderAddress,
  type ReaderAddress,
} from './reader-address';

/**
 * Resolves an address in a test, failing loudly rather than returning a union.
 *
 * @param book - Book token.
 * @param chapter - Chapter token.
 * @returns The address. Side effects: none.
 */
function address(book: string | number, chapter: string | number): ReaderAddress {
  const result = resolveReaderAddress(book, chapter);
  if (!result.ok) {
    throw new Error(
      `expected ${String(book)} ${String(chapter)} to resolve: ${result.error.message}`,
    );
  }
  return result.value;
}

describe('resolveReaderAddress', () => {
  it('resolves every canonical book by name, slug, osis code and number', () => {
    for (const book of CANONICAL_BOOKS) {
      for (const token of [book.name, book.id, book.osis, book.canonicalNumber]) {
        expect(address(token, 1).book.canonicalNumber).toBe(book.canonicalNumber);
      }
    }
  });

  it('accepts the spellings the prototype accepted', () => {
    expect(address('1cor', 13).book.name).toBe('1 Corinthians');
    expect(address('1 Cor', 13).book.name).toBe('1 Corinthians');
    expect(address('song-of-solomon', 1).book.name).toBe('Song of Solomon');
  });

  it('accepts a zero-padded chapter, because a URL may carry one', () => {
    expect(address('John', '03').chapter).toBe(3);
  });

  it('names the book in the not-found message', () => {
    const result = resolveReaderAddress('Hezekiah', 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BOOK_NOT_FOUND');
    expect(result.error.message).toContain('Hezekiah');
  });

  it.each(['', '   ', 'three', '3.5', '-2', '1e3'])('rejects %o as a chapter', (token) => {
    const result = resolveReaderAddress('John', token);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CHAPTER_NOT_A_NUMBER');
  });

  it('reports the real chapter count when the chapter is out of range', () => {
    const result = resolveReaderAddress('John', 99);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CHAPTER_OUT_OF_RANGE');
    expect(result.error.message).toContain('21 chapters');
  });

  it('rejects chapter zero', () => {
    expect(resolveReaderAddress('John', 0).ok).toBe(false);
  });
});

describe('walking the canon', () => {
  it('steps within a book', () => {
    expect(nextChapter(address('John', 3))?.chapter).toBe(4);
    expect(previousChapter(address('John', 3))?.chapter).toBe(2);
  });

  it('rolls forward over every book boundary', () => {
    for (const book of CANONICAL_BOOKS.slice(0, -1)) {
      const next = nextChapter(address(book.canonicalNumber, book.chapterCount));
      expect(next?.book.canonicalNumber).toBe(book.canonicalNumber + 1);
      expect(next?.chapter).toBe(1);
    }
  });

  it('rolls backward onto the previous book’s last chapter', () => {
    for (const book of CANONICAL_BOOKS.slice(1)) {
      const previous = previousChapter(address(book.canonicalNumber, 1));
      expect(previous?.book.canonicalNumber).toBe(book.canonicalNumber - 1);
      expect(previous?.chapter).toBe(previous?.book.chapterCount);
    }
  });

  it('stops at both ends of the canon', () => {
    expect(previousChapter(address('Genesis', 1))).toBeUndefined();
    expect(nextChapter(address('Revelation', 22))).toBeUndefined();
  });

  it('reaches Revelation 22 from Genesis 1 in exactly one step per chapter', () => {
    const totalChapters = CANONICAL_BOOKS.reduce((sum, book) => sum + book.chapterCount, 0);
    let cursor: ReaderAddress | undefined = address('Genesis', 1);
    let visited = 0;
    while (cursor !== undefined) {
      visited += 1;
      cursor = nextChapter(cursor);
    }
    expect(visited).toBe(totalChapters);
  });
});

describe('formatting', () => {
  it('renders the reference the header shows', () => {
    expect(readerReference(address('1cor', 13))).toBe('1 Corinthians 13');
  });

  it('renders a route path with the book slug', () => {
    expect(readerPath(address('1cor', 13))).toBe('/read/1-corinthians/13');
  });
});
