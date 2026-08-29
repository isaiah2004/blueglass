/**
 * Resolving any spelling of a book to its canonical row.
 *
 * Purpose
 *   One entry point for "what book is this?", replacing the Flutter prototype's two
 *   partial hand-written maps (`flutter-port-map.md` §8 risk 10). Whether the token came
 *   from a deep link, a typed search, an OSIS id, or an API `book_number`, it resolves
 *   here or it fails loudly with a structured error — it never silently becomes book 0.
 *
 * Key responsibilities
 *   - Build the alias index once, at module load, from `CANONICAL_BOOKS`.
 *   - Resolve names, OSIS codes, aliases, and bare book numbers.
 *   - Return `Result`, never `null`, never a thrown error (rule 6.1.4).
 *
 * Dependencies
 *   `../result`, `./books.data`, `./book-token`, `./scripture-error`. Pure: no I/O,
 *   no clock, no logger.
 *
 * Usage
 *   ```ts
 *   const resolved = bookFromAny(routeParams.book);
 *   if (!resolved.ok) return <UnknownBook error={resolved.error} />;
 *   ```
 */

import { fail, succeed, type Result } from '../result';
import { isBookNumberToken, normaliseBookToken } from './book-token';
import { CANONICAL_BOOK_COUNT, CANONICAL_BOOKS } from './books.data';
import type { BookNumber, CanonicalBook } from './canonical-book.types';
import { scriptureError, type ScriptureError } from './scripture-error';

/** Every normalised alias in the canon, mapped to the book it names. */
const BOOKS_BY_ALIAS: ReadonlyMap<string, CanonicalBook> = new Map(
  CANONICAL_BOOKS.flatMap((book) => book.aliases.map((alias) => [alias, book] as const)),
);

/** The canon indexed by book number, so lookup does not scan the array. */
const BOOKS_BY_NUMBER: ReadonlyMap<BookNumber, CanonicalBook> = new Map(
  CANONICAL_BOOKS.map((book) => [book.canonicalNumber, book] as const),
);

/**
 * Resolve a book number to its canonical row.
 *
 * @param bookNumber - A 1-based canon position. `0`, `67`, and non-integers all fail.
 * @returns The book, or a `BOOK_NUMBER_OUT_OF_RANGE` error. Side effects: none.
 *
 * @example
 * bookFromNumber(43); // ok: John
 * bookFromNumber(0);  // error: BOOK_NUMBER_OUT_OF_RANGE — the Flutter corruption value
 */
export function bookFromNumber(bookNumber: number): Result<CanonicalBook, ScriptureError> {
  const book = Number.isInteger(bookNumber) ? BOOKS_BY_NUMBER.get(bookNumber) : undefined;

  if (book === undefined) {
    return fail(
      scriptureError(
        'BOOK_NUMBER_OUT_OF_RANGE',
        `Book number must be a whole number from 1 to ${CANONICAL_BOOK_COUNT}.`,
        bookNumber,
      ),
    );
  }

  return succeed(book);
}

/**
 * Resolve any way of naming a book to its canonical row.
 *
 * Accepts the canonical name (`1 Corinthians`), the OSIS code (`1Cor`), any curated
 * alias (`1co`), any casing or punctuation of those (`1 CORINTHIANS.`), and a bare book
 * number as either a number or a digit string (`46`, `"46"`).
 *
 * @param input - The token to resolve.
 * @returns The book, or a structured error naming why it did not resolve.
 *
 * Side effects: none.
 *
 * @example
 * bookFromAny('1jn');    // ok: 1 John
 * bookFromAny('Psalm');  // ok: Psalms
 * bookFromAny('Hogwarts'); // error: UNKNOWN_BOOK
 */
export function bookFromAny(input: string | number): Result<CanonicalBook, ScriptureError> {
  if (typeof input === 'number') {
    return bookFromNumber(input);
  }

  const token = normaliseBookToken(input);

  if (token === '') {
    return fail(scriptureError('MALFORMED_REFERENCE', 'A book reference cannot be empty.', input));
  }

  if (isBookNumberToken(token)) {
    return bookFromNumber(Number(token));
  }

  const book = BOOKS_BY_ALIAS.get(token);

  if (book === undefined) {
    return fail(scriptureError('UNKNOWN_BOOK', `No book of the Bible is named "${input}".`, input));
  }

  return succeed(book);
}

/**
 * Resolve any way of naming a book to its canon position.
 *
 * The counterpart of {@link bookFromAny} for the many API payloads that carry
 * `book_number` rather than a name (`flutter-port-map.md` §7, endpoints 8-14).
 *
 * @param input - The token to resolve; same forms as {@link bookFromAny}.
 * @returns The 1-based book number, or a structured error. Side effects: none.
 */
export function bookNumberFromAny(input: string | number): Result<BookNumber, ScriptureError> {
  const resolved = bookFromAny(input);

  return resolved.ok ? succeed(resolved.value.canonicalNumber) : resolved;
}
