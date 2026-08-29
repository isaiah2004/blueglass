/**
 * The non-negotiable proof that all 66 books round-trip.
 *
 * Purpose
 *   `flutter-port-map.md` §8 risk 10 is a live data-corruption bug: the Flutter client
 *   maps three books between name and number, so a note added in John persists
 *   `book_number: 0`. This suite is the regression gate that stops the rewrite
 *   reproducing it. If a book stops resolving, this fails before any user loses a note.
 *
 * What it proves
 *   - The table is the full canon: 66 books, in order, 39 Old and 27 New.
 *   - Every book round-trips by name, OSIS code, route slug, and alias — all 66, each
 *     as its own named test, so a failure names the book that broke.
 *   - The chapter counts total the KJV's published 1189, an independent checksum that a
 *     silent transcription slip cannot survive.
 *   - No alias resolves to two different books.
 */

import { describe, expect, it } from 'vitest';

import { unwrapValue } from '../testing/unwrap-result';
import { bookFromAny, bookFromNumber, bookNumberFromAny } from './book-lookup';
import { CANONICAL_BOOK_COUNT, CANONICAL_BOOKS } from './books.data';

/** Published KJV chapter totals — the checksum a transcription error cannot fake. */
const KJV_CHAPTER_TOTALS = { oldTestament: 929, newTestament: 260, whole: 1189 };

/** Published book counts per testament. */
const KJV_BOOK_COUNTS = { oldTestament: 39, newTestament: 27 };

/**
 * Sum the chapters of the books in one testament.
 *
 * @param testament - `'ot'` or `'nt'`.
 * @returns The total chapter count across that testament.
 */
function chapterTotal(testament: 'ot' | 'nt'): number {
  return CANONICAL_BOOKS.filter((book) => book.testament === testament).reduce(
    (total, book) => total + book.chapterCount,
    0,
  );
}

describe('the canonical book table', () => {
  it('holds the whole Protestant canon and nothing else', () => {
    expect(CANONICAL_BOOKS).toHaveLength(CANONICAL_BOOK_COUNT);
  });

  it('numbers the books 1 to 66 in canonical order', () => {
    const numbers = CANONICAL_BOOKS.map((book) => book.canonicalNumber);

    expect(numbers).toEqual(Array.from({ length: CANONICAL_BOOK_COUNT }, (_, i) => i + 1));
  });

  it('splits into 39 Old Testament and 27 New Testament books', () => {
    const oldTestament = CANONICAL_BOOKS.filter((book) => book.testament === 'ot');
    const newTestament = CANONICAL_BOOKS.filter((book) => book.testament === 'nt');

    expect(oldTestament).toHaveLength(KJV_BOOK_COUNTS.oldTestament);
    expect(newTestament).toHaveLength(KJV_BOOK_COUNTS.newTestament);
  });

  it('matches the published KJV chapter totals', () => {
    expect(chapterTotal('ot')).toBe(KJV_CHAPTER_TOTALS.oldTestament);
    expect(chapterTotal('nt')).toBe(KJV_CHAPTER_TOTALS.newTestament);
    expect(chapterTotal('ot') + chapterTotal('nt')).toBe(KJV_CHAPTER_TOTALS.whole);
  });

  it('gives every book a unique name, OSIS code, and route slug', () => {
    expect(new Set(CANONICAL_BOOKS.map((book) => book.name)).size).toBe(CANONICAL_BOOK_COUNT);
    expect(new Set(CANONICAL_BOOKS.map((book) => book.osis)).size).toBe(CANONICAL_BOOK_COUNT);
    expect(new Set(CANONICAL_BOOKS.map((book) => book.id)).size).toBe(CANONICAL_BOOK_COUNT);
  });

  it('never lets one alias mean two different books', () => {
    const owners = new Map<string, string>();
    const collisions: string[] = [];

    for (const book of CANONICAL_BOOKS) {
      for (const alias of book.aliases) {
        const owner = owners.get(alias);
        if (owner !== undefined) {
          collisions.push(`"${alias}" is claimed by both ${owner} and ${book.name}`);
        }
        owners.set(alias, book.name);
      }
    }

    expect(collisions).toEqual([]);
  });
});

describe('every one of the 66 books round-trips', () => {
  for (const book of CANONICAL_BOOKS) {
    const label = `${String(book.canonicalNumber)} ${book.name}`;

    it(`resolves ${label} by number, name, OSIS code, slug, and every alias`, () => {
      // number -> book -> number: the leg the Flutter client got wrong.
      expect(unwrapValue(bookFromNumber(book.canonicalNumber))).toBe(book);
      expect(unwrapValue(bookNumberFromAny(book.canonicalNumber))).toBe(book.canonicalNumber);

      // name -> number -> name, for the picker and for deep links.
      expect(unwrapValue(bookNumberFromAny(book.name))).toBe(book.canonicalNumber);
      expect(unwrapValue(bookFromAny(book.name)).name).toBe(book.name);

      // The identifiers the API and the router use.
      expect(unwrapValue(bookFromAny(book.osis))).toBe(book);
      expect(unwrapValue(bookFromAny(book.id))).toBe(book);
      expect(unwrapValue(bookFromAny(String(book.canonicalNumber)))).toBe(book);

      for (const alias of book.aliases) {
        expect(unwrapValue(bookFromAny(alias))).toBe(book);
      }
    });

    it(`resolves ${label} however a reader types it`, () => {
      const spaceless = book.name.split(' ').join('');

      expect(unwrapValue(bookFromAny(book.name.toUpperCase()))).toBe(book);
      expect(unwrapValue(bookFromAny(book.name.toLowerCase()))).toBe(book);
      expect(unwrapValue(bookFromAny(spaceless))).toBe(book);
      expect(unwrapValue(bookFromAny(`  ${book.name}.  `))).toBe(book);
    });
  }
});
