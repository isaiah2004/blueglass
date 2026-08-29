/**
 * Tests for URL building.
 *
 * What these prove
 *   - A book name with a space stays one path segment, encoded — the failure mode that
 *     turns `Song of Solomon` into a 404 and `1 Cor` into two segments.
 *   - A space in a query value is `%20`, never `+`.
 *   - Absent query parameters vanish rather than being sent as the string `undefined`.
 */

import { describe, expect, it } from 'vitest';

import { buildRequestUrl, encodePath, encodeQuery } from './request-url';

describe('encodePath', () => {
  it('encodes each segment but keeps the separators', () => {
    expect(encodePath('/chapters/BSB/Song of Solomon/2')).toBe(
      '/chapters/BSB/Song%20of%20Solomon/2',
    );
  });

  it('encodes a character that would otherwise start a new segment', () => {
    expect(encodePath('/books/1 Cor')).toBe('/books/1%20Cor');
    expect(encodePath('/books/a?b')).toBe('/books/a%3Fb');
  });
});

describe('encodeQuery', () => {
  it('returns an empty string when nothing survives', () => {
    expect(encodeQuery({})).toBe('');
    expect(encodeQuery({ scope: undefined, limit: null })).toBe('');
  });

  it('encodes a space as %20, not +', () => {
    expect(encodeQuery({ q: 'my beloved' })).toBe('?q=my%20beloved');
  });

  it('keeps the object order and joins with &', () => {
    expect(encodeQuery({ q: 'love', limit: 5, scope: 'all' })).toBe('?q=love&limit=5&scope=all');
  });

  it('encodes a value that would otherwise be read as a separator', () => {
    expect(encodeQuery({ q: 'a&b=c' })).toBe('?q=a%26b%3Dc');
  });

  it('renders a boolean as its JSON spelling', () => {
    expect(encodeQuery({ web: true })).toBe('?web=true');
  });
});

describe('buildRequestUrl', () => {
  it('joins base, path and query', () => {
    expect(buildRequestUrl('http://api.test', '/books', { limit: 66 })).toBe(
      'http://api.test/books?limit=66',
    );
  });

  it('tolerates a trailing slash on the base without doubling it', () => {
    expect(buildRequestUrl('http://api.test///', '/books')).toBe('http://api.test/books');
  });

  it('tolerates a path that does not start with a slash', () => {
    expect(buildRequestUrl('http://api.test', 'books')).toBe('http://api.test/books');
  });
});
