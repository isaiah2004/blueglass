/**
 * Tests for the navigator's book search.
 *
 * The spellings asserted here are the ones `flutter-port-map.md` §7.6 names by hand, plus
 * the ordering rule that stops a search for `John` burying John under 1-3 John.
 */

import { CANONICAL_BOOK_COUNT } from '@atlas/shared';
import { describe, expect, it } from 'vitest';

import { filterBooks, firstMatchingBook, TESTAMENT_FILTERS, testamentLabel } from './book-filter';

describe('filterBooks', () => {
  it('lists the whole canon for an empty query', () => {
    expect(filterBooks('')).toHaveLength(CANONICAL_BOOK_COUNT);
  });

  it('splits the canon at 39 and 27', () => {
    expect(filterBooks('', 'ot')).toHaveLength(39);
    expect(filterBooks('', 'nt')).toHaveLength(27);
  });

  it.each([
    ['1cor', '1 Corinthians'],
    ['1 Cor', '1 Corinthians'],
    ['  1   c o r  ', '1 Corinthians'],
    ['songofsongs', 'Song of Solomon'],
    ['ps', 'Psalms'],
    ['REV', 'Revelation'],
  ])('resolves %o to %s', (query, expected) => {
    expect(firstMatchingBook(query)?.name).toBe(expected);
  });

  it('puts John before 1 John', () => {
    const names = filterBooks('john').map((book) => book.name);
    expect(names[0]).toBe('John');
    expect(names).toContain('1 John');
  });

  it('keeps canonical order inside each band', () => {
    const numbers = filterBooks('j').map((book) => book.canonicalNumber);
    // Judges, Jude and Jonah all start with `j`; `Joshua` does too. The band boundary is
    // wherever the run stops ascending, and each side of it must ascend on its own.
    const boundary = numbers.findIndex(
      (value, index) => index > 0 && value < (numbers[index - 1] ?? 0),
    );
    const bands =
      boundary === -1 ? [numbers] : [numbers.slice(0, boundary), numbers.slice(boundary)];
    for (const band of bands) {
      expect(band).toEqual([...band].sort((left, right) => left - right));
    }
  });

  it('lists every prefix match before any substring-only match', () => {
    const names = filterBooks('john').map((book) => book.name);
    expect(names[0]).toBe('John');
    // The rest are substring hits, including Revelation, whose alias table carries
    // `revelationofjohn`. Finding it by the name of its author is a feature, not a leak.
    expect(names.slice(1)).toEqual(['1 John', '2 John', '3 John', 'Revelation']);
  });

  it('honours the testament pill alongside the query', () => {
    expect(filterBooks('j', 'nt').every((book) => book.testament === 'nt')).toBe(true);
    expect(filterBooks('john', 'ot')).toHaveLength(0);
  });

  it('returns nothing for a book that is not in the canon', () => {
    expect(filterBooks('hezekiah')).toHaveLength(0);
    expect(firstMatchingBook('hezekiah')).toBeUndefined();
  });

  it('finds every book by its own name', () => {
    for (const book of filterBooks('')) {
      expect(firstMatchingBook(book.name)?.canonicalNumber).toBe(book.canonicalNumber);
    }
  });
});

describe('testament pills', () => {
  it('offers all three, labelled', () => {
    expect(TESTAMENT_FILTERS).toEqual(['all', 'ot', 'nt']);
    expect(TESTAMENT_FILTERS.map(testamentLabel)).toEqual(['All', 'Old', 'New']);
  });
});
