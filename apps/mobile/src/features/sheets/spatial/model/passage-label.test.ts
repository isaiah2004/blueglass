/**
 * Tests for rendering packed verse keys and OSIS ids as references.
 *
 * The rule under test is the refusal: a key that does not resolve prints nothing. Printing
 * `44016011` at a reader would be the app claiming to know a reference it does not.
 */

import { describe, expect, it } from 'vitest';

import { formatOsis, formatPassage, formatVerseKey } from './passage-label';

describe('formatVerseKey', () => {
  it('renders a packed key as a reference', () => {
    expect(formatVerseKey(44016011)).toBe('Acts 16:11');
  });

  it('renders a key from the far end of the canon', () => {
    expect(formatVerseKey(1001001)).toBe('Genesis 1:1');
  });

  it('returns null rather than a raw integer for a key that names no verse', () => {
    expect(formatVerseKey(99999999)).toBeNull();
    expect(formatVerseKey(-1)).toBeNull();
    expect(formatVerseKey(1.5)).toBeNull();
  });
});

describe('formatPassage', () => {
  it('renders a span inside one chapter as a verse range', () => {
    expect(formatPassage({ startKey: 44016001, endKey: 44016014 })).toBe('Acts 16:1-14');
  });

  it('renders a single-verse span without a range', () => {
    expect(formatPassage({ startKey: 44016011, endKey: 44016011 })).toBe('Acts 16:11');
  });

  it('spells both ends out when the span crosses a chapter', () => {
    expect(formatPassage({ startKey: 44016040, endKey: 44017001 })).toBe('Acts 16:40 – Acts 17:1');
  });

  it('spells both ends out when the span crosses a book', () => {
    expect(formatPassage({ startKey: 44028031, endKey: 45001001 })).toContain('–');
  });

  it('returns null when either end fails to resolve', () => {
    expect(formatPassage({ startKey: 99999999, endKey: 44016014 })).toBeNull();
    expect(formatPassage({ startKey: 44016001, endKey: 99999999 })).toBeNull();
  });
});

describe('formatOsis', () => {
  it('renders an OSIS point as a reference', () => {
    expect(formatOsis('Acts.16.1')).toBe('Acts 16:1');
  });

  it('resolves the book code rather than printing it — 1Cor is not a book name', () => {
    expect(formatOsis('1Cor.1.1')).toBe('1 Corinthians 1:1');
  });

  it('returns null for anything that is not three dot-separated parts', () => {
    expect(formatOsis('Acts.16')).toBeNull();
    expect(formatOsis('Acts.16.1.2')).toBeNull();
    expect(formatOsis('')).toBeNull();
  });

  it('returns null for a book code that names no canonical book', () => {
    expect(formatOsis('Nowhere.1.1')).toBeNull();
  });

  it('returns null for a non-numeric chapter or verse', () => {
    expect(formatOsis('Acts.x.1')).toBeNull();
    expect(formatOsis('Acts.16.y')).toBeNull();
  });
});
