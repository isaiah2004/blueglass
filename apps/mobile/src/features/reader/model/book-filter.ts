/**
 * Finding a book in the navigator.
 *
 * Purpose
 *   `flutter-port-map.md` §7.6 asks for the prototype's search behaviour to be ported
 *   faithfully, and names the part that matters: the query is normalised so that `1cor`,
 *   `1 Cor` and `songofsongs` all hit. That normalisation already exists in
 *   `@atlas/shared` — the same function the API resolves book tokens with — so the client
 *   and the server agree on what a book is called, rather than each keeping its own list.
 *
 * Why matches are ranked in two bands
 *   A plain substring match on the normalised form makes `john` return `1 John`, `2 John`
 *   and `3 John` *before* `John`, because the canon orders them that way — burying the
 *   book the reader almost certainly meant. Prefix matches are therefore listed first, and
 *   the books that merely contain the query follow. Within each band the canon's own order
 *   is kept, so a reader scanning for Habakkuk still finds it between Nahum and Zephaniah.
 *
 * Dependencies
 *   `@atlas/shared` only. No React, no React Native, no I/O.
 */

import { CANONICAL_BOOKS, normaliseBookToken, type CanonicalBook } from '@atlas/shared';

/** Which half of the canon the navigator is showing. */
export type TestamentFilter = 'all' | 'ot' | 'nt';

/** The three filter pills, in the order the navigator shows them. */
export const TESTAMENT_FILTERS: readonly TestamentFilter[] = ['all', 'ot', 'nt'];

/**
 * Human label for a testament filter.
 *
 * @param filter - The filter to label.
 * @returns A short pill label. Side effects: none.
 */
export function testamentLabel(filter: TestamentFilter): string {
  const labels: Record<TestamentFilter, string> = {
    all: 'All',
    ot: 'Old',
    nt: 'New',
  };
  return labels[filter];
}

/**
 * Whether any of a book's aliases starts with the query.
 *
 * @param book - The candidate.
 * @param token - The already-normalised query.
 * @returns True for a prefix hit. Side effects: none.
 */
function startsWithQuery(book: CanonicalBook, token: string): boolean {
  return book.aliases.some((alias) => alias.startsWith(token));
}

/**
 * Whether any of a book's aliases contains the query anywhere.
 *
 * @param book - The candidate.
 * @param token - The already-normalised query.
 * @returns True for a substring hit. Side effects: none.
 */
function containsQuery(book: CanonicalBook, token: string): boolean {
  return book.aliases.some((alias) => alias.includes(token));
}

/**
 * The books the navigator should list.
 *
 * @param query - What the reader typed. Spaces and punctuation are ignored.
 * @param testament - Which pill is active.
 * @returns Prefix matches first, then substring matches, each band in canonical order.
 *   Side effects: none.
 */
export function filterBooks(
  query: string,
  testament: TestamentFilter = 'all',
): readonly CanonicalBook[] {
  const token = normaliseBookToken(query);
  const inTestament = CANONICAL_BOOKS.filter(
    (book) => testament === 'all' || book.testament === testament,
  );
  if (token === '') {
    return inTestament;
  }

  const prefixed = inTestament.filter((book) => startsWithQuery(book, token));
  const contained = inTestament.filter(
    (book) => !startsWithQuery(book, token) && containsQuery(book, token),
  );
  return [...prefixed, ...contained];
}

/**
 * The book an Enter keypress should jump to.
 *
 * The prototype's search field navigates straight to the first match on Enter
 * (`reference_picker.dart:189-192`), which is what makes typing `1cor` and pressing Enter
 * a two-second navigation.
 *
 * @param query - What the reader typed.
 * @param testament - Which pill is active.
 * @returns The first match, or `undefined` when nothing matched. Side effects: none.
 */
export function firstMatchingBook(
  query: string,
  testament: TestamentFilter = 'all',
): CanonicalBook | undefined {
  return filterBooks(query, testament)[0];
}
