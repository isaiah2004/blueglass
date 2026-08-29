/**
 * Every TanStack Query cache key, built in one place.
 *
 * Purpose
 *   A cache key is a shared namespace with no compiler behind it, exactly like a storage
 *   key. Two hooks that spell the same query differently keep two copies of it and
 *   refetch twice; two that spell *different* queries the same serve one chapter's text
 *   for another. Both bugs are silent, and both are impossible if no key is ever written
 *   twice.
 *
 * Shape
 *   `[resource, ...discriminators]`, resource first, so a prefix invalidates a family:
 *   `invalidateQueries({ queryKey: atlasQueryKeys.chapters() })` drops every chapter in
 *   every translation, which is what a translation switch wants.
 *
 * Normalisation matters here
 *   A key is compared structurally, so `'john'` and `'John'` are two caches of one
 *   chapter. Book tokens and translation codes are normalised on the way in — the
 *   server is case-insensitive about both, and the cache must agree with the server or
 *   it is not a cache of it.
 *
 * Dependencies
 *   None.
 */

/** A cache key. Readonly so a key handed to two hooks cannot be mutated by one. */
export type AtlasQueryKey = readonly unknown[];

/** Lowercase and trim, so `' John '` and `'john'` are the same cache entry. */
function normaliseToken(token: string | number): string {
  return String(token).trim().toLowerCase();
}

/** The key factory. Every hook in `src/api/query` gets its key from here. */
export const atlasQueryKeys = {
  /** Root of everything this API layer caches; clears the lot. */
  all: (): AtlasQueryKey => ['atlas'],

  /** `GET /health`. */
  health: (): AtlasQueryKey => ['atlas', 'health'],

  /** `GET /me` — scoped by nothing, because the device id is the identity. */
  identity: (): AtlasQueryKey => ['atlas', 'identity'],

  /** `GET /translations`. */
  translations: (): AtlasQueryKey => ['atlas', 'translations'],

  /** `GET /books` — the canon, which never changes. */
  books: (): AtlasQueryKey => ['atlas', 'books'],

  /** Prefix for every chapter, in every translation. */
  chapters: (): AtlasQueryKey => ['atlas', 'chapter'],

  /** Prefix for every chapter of one translation. */
  chaptersIn: (translation: string): AtlasQueryKey => [
    'atlas',
    'chapter',
    normaliseToken(translation),
  ],

  /** One chapter. */
  chapter: (translation: string, book: string | number, chapter: number): AtlasQueryKey => [
    'atlas',
    'chapter',
    normaliseToken(translation),
    normaliseToken(book),
    chapter,
  ],

  /** Prefix for every search. */
  searches: (): AtlasQueryKey => ['atlas', 'search'],

  /**
   * One search.
   *
   * The query text is normalised but **not** truncated: two different searches must
   * never collide, and a long query is a small key next to the results it caches.
   */
  search: (query: string, translation: string, scope: string): AtlasQueryKey => [
    'atlas',
    'search',
    normaliseToken(translation),
    normaliseToken(scope),
    query.trim().toLowerCase(),
  ],
} as const;
