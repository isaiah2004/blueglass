/**
 * Where the reader is pointed: a book and a chapter, resolved and range-checked.
 *
 * Purpose
 *   The reader's route is `/read/[book]/[chapter]`, and both segments arrive as untrusted
 *   strings. This module is the one place they become a validated address, and the one
 *   place "what comes after Revelation 22" is answered. Everything downstream — the
 *   header, the pager, the prefetcher — reads an address it can trust.
 *
 * Key responsibilities
 *   - Resolve any spelling of a book (`John`, `1cor`, `song-of-solomon`, `43`) through
 *     the canonical 66-book table in `@atlas/shared`.
 *   - Reject a chapter that the book does not have, with a message a reader can act on.
 *   - Walk forwards and backwards across the whole canon, rolling over book boundaries.
 *
 * Why a Result rather than a throw
 *   A bad URL is an expected input, not an exception: the reader renders an error state
 *   for it. Rule 6 — errors that the caller must handle are values.
 *
 * Dependencies
 *   `@atlas/shared` only. No React, no React Native, no I/O — so it is unit-testable and
 *   equally usable from a route, a deep link, or a test.
 */

import {
  bookFromAny,
  CANONICAL_BOOK_COUNT,
  bookFromNumber,
  fail,
  succeed,
  type CanonicalBook,
  type Result,
} from '@atlas/shared';

/** Why an address could not be resolved. */
export type ReaderAddressErrorCode =
  'BOOK_NOT_FOUND' | 'CHAPTER_NOT_A_NUMBER' | 'CHAPTER_OUT_OF_RANGE';

/** A resolution failure, carrying enough to render a specific message. */
export interface ReaderAddressError {
  readonly code: ReaderAddressErrorCode;
  /** Reader-facing sentence. Already complete; call sites never append to it. */
  readonly message: string;
}

/** A validated position in scripture: this book, this chapter. */
export interface ReaderAddress {
  readonly book: CanonicalBook;
  /** 1-based, and guaranteed to be within `book.chapterCount`. */
  readonly chapter: number;
}

/**
 * Builds a failure without repeating the shape at four call sites.
 *
 * @param code - Which failure this is.
 * @param message - The reader-facing sentence.
 * @returns The failed result. Side effects: none.
 */
function addressError(
  code: ReaderAddressErrorCode,
  message: string,
): Result<ReaderAddress, ReaderAddressError> {
  return fail({ code, message });
}

/**
 * Parses a chapter segment. Route params are strings even when they look like numbers.
 *
 * @param token - The raw chapter segment, e.g. `"3"`.
 * @returns The chapter as an integer, or `undefined` when the token is not one.
 *   Side effects: none.
 */
function parseChapterToken(token: string | number): number | undefined {
  if (typeof token === 'number') {
    return Number.isInteger(token) ? token : undefined;
  }
  const trimmed = token.trim();
  // `Number('')` is 0 and `Number(' 3 ')` is 3, so the emptiness check comes first and the
  // integer check second. A bare regex would reject `03`, which is a legitimate URL.
  if (trimmed === '' || !/^\d+$/.test(trimmed)) {
    return undefined;
  }
  return Number(trimmed);
}

/**
 * Resolve a book token and a chapter token into an address.
 *
 * @param bookToken - Any accepted spelling of a book, or its canonical number.
 * @param chapterToken - The chapter, as a string from the route or as a number.
 * @returns The validated address, or the reason it is not one. Side effects: none.
 */
export function resolveReaderAddress(
  bookToken: string | number,
  chapterToken: string | number,
): Result<ReaderAddress, ReaderAddressError> {
  const book = bookFromAny(bookToken);
  if (!book.ok) {
    return addressError(
      'BOOK_NOT_FOUND',
      `We could not find a book called “${String(bookToken)}”.`,
    );
  }

  const chapter = parseChapterToken(chapterToken);
  if (chapter === undefined) {
    return addressError(
      'CHAPTER_NOT_A_NUMBER',
      `“${String(chapterToken)}” is not a chapter number.`,
    );
  }

  if (chapter < 1 || chapter > book.value.chapterCount) {
    return addressError(
      'CHAPTER_OUT_OF_RANGE',
      `${book.value.name} has ${String(book.value.chapterCount)} chapters, so there is no chapter ${String(chapter)}.`,
    );
  }

  return succeed({ book: book.value, chapter });
}

/**
 * The chapter after this one, rolling into the next book at a book's end.
 *
 * @param address - Where the reader is now.
 * @returns The next address, or `undefined` at Revelation 22 — the end of the canon.
 *   Side effects: none.
 */
export function nextChapter(address: ReaderAddress): ReaderAddress | undefined {
  if (address.chapter < address.book.chapterCount) {
    return { book: address.book, chapter: address.chapter + 1 };
  }
  if (address.book.canonicalNumber >= CANONICAL_BOOK_COUNT) {
    return undefined;
  }
  const next = bookFromNumber(address.book.canonicalNumber + 1);
  return next.ok ? { book: next.value, chapter: 1 } : undefined;
}

/**
 * The chapter before this one, rolling into the previous book's last chapter.
 *
 * @param address - Where the reader is now.
 * @returns The previous address, or `undefined` at Genesis 1. Side effects: none.
 */
export function previousChapter(address: ReaderAddress): ReaderAddress | undefined {
  if (address.chapter > 1) {
    return { book: address.book, chapter: address.chapter - 1 };
  }
  if (address.book.canonicalNumber <= 1) {
    return undefined;
  }
  const previous = bookFromNumber(address.book.canonicalNumber - 1);
  return previous.ok ? { book: previous.value, chapter: previous.value.chapterCount } : undefined;
}

/**
 * The human reference for an address, e.g. `John 3`.
 *
 * @param address - The address to render.
 * @returns Book name and chapter, space separated. Side effects: none.
 */
export function readerReference(address: ReaderAddress): string {
  return `${address.book.name} ${String(address.chapter)}`;
}

/**
 * The route path an address lives at.
 *
 * @param address - The address to link to.
 * @returns A path such as `/read/1-corinthians/13`. Side effects: none.
 */
export function readerPath(address: ReaderAddress): string {
  return `/read/${address.book.id}/${String(address.chapter)}`;
}
