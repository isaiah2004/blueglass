/**
 * Tests for the cache-key factory.
 *
 * What these prove
 *   - Keys normalise the tokens the server itself is insensitive to, so `John` and
 *     `john` are one cache entry rather than two copies of one chapter.
 *   - Keys that must differ, do — a different chapter, translation, or search text is
 *     never served another's data.
 *   - Prefixes nest, so invalidating a family really does cover its members.
 */

import { describe, expect, it } from 'vitest';

import { atlasQueryKeys } from './query-keys';

/** Does `key` begin with `prefix`? That is what TanStack's prefix matching asks. */
function startsWith(key: readonly unknown[], prefix: readonly unknown[]): boolean {
  return prefix.every((segment, index) => key[index] === segment);
}

describe('atlasQueryKeys', () => {
  it('normalises case and surrounding space in a chapter address', () => {
    expect(atlasQueryKeys.chapter('BSB', 'John', 3)).toEqual(
      atlasQueryKeys.chapter('bsb', ' john ', 3),
    );
  });

  it('keeps different chapters apart', () => {
    expect(atlasQueryKeys.chapter('BSB', 'John', 3)).not.toEqual(
      atlasQueryKeys.chapter('BSB', 'John', 4),
    );
    expect(atlasQueryKeys.chapter('BSB', 'John', 3)).not.toEqual(
      atlasQueryKeys.chapter('KJV', 'John', 3),
    );
  });

  it('treats a book number and a book name as different addresses', () => {
    // Both resolve server-side; they are two spellings the cache does not unify, which
    // costs one extra fetch and never serves the wrong text.
    expect(atlasQueryKeys.chapter('BSB', 43, 3)).not.toEqual(
      atlasQueryKeys.chapter('BSB', 'John', 3),
    );
  });

  it('nests every chapter key under the chapters prefix', () => {
    const key = atlasQueryKeys.chapter('BSB', 'John', 3);

    expect(startsWith(key, atlasQueryKeys.chapters())).toBe(true);
    expect(startsWith(key, atlasQueryKeys.chaptersIn('bsb'))).toBe(true);
    expect(startsWith(key, atlasQueryKeys.chaptersIn('kjv'))).toBe(false);
  });

  it('nests everything under the root key', () => {
    for (const key of [
      atlasQueryKeys.health(),
      atlasQueryKeys.identity(),
      atlasQueryKeys.books(),
      atlasQueryKeys.translations(),
      atlasQueryKeys.chapter('BSB', 'John', 3),
      atlasQueryKeys.search('love', 'BSB', 'all'),
    ]) {
      expect(startsWith(key, atlasQueryKeys.all())).toBe(true);
    }
  });

  it('keeps different searches apart, and does not truncate a long query', () => {
    const long = 'a'.repeat(400);

    expect(atlasQueryKeys.search('love', 'BSB', 'all')).not.toEqual(
      atlasQueryKeys.search('loved', 'BSB', 'all'),
    );
    expect(atlasQueryKeys.search(long, 'BSB', 'all')).not.toEqual(
      atlasQueryKeys.search(`${long}b`, 'BSB', 'all'),
    );
  });

  it('separates a book-scoped search from a whole-canon one', () => {
    expect(atlasQueryKeys.search('love', 'BSB', 'all')).not.toEqual(
      atlasQueryKeys.search('love', 'BSB', 'John'),
    );
  });
});
