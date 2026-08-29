/**
 * The `VerseKey` value object — the app's universal identity for a single verse.
 *
 * Purpose
 *   The API keys highlights, notes, search hits, and cross-references off one integer:
 *   `book_number × 1_000_000 + chapter × 1_000 + verse`, so John 3:16 is `43003016`
 *   (`server/app/scripture/refs.py:7-19`). `flutter-port-map.md` §7 says to adopt it
 *   verbatim. This module is that encoding, plus the validation the server does not do.
 *
 * Key responsibilities
 *   - Construct a verse key only from a book, chapter, and verse that actually exist.
 *   - Decode an integer back into its parts without losing the resolved book.
 *   - Render the OSIS id (`John.3.16`) the API expects in paths.
 *
 * Dependencies
 *   `../result`, `./book-lookup`, `./canonical-book.types`, `./scripture-error`,
 *   `./verse-reference.types`. Pure: no I/O, no clock.
 *
 * Invariant
 *   A `VerseKey` that exists is valid. Every field was range-checked at construction,
 *   so nothing downstream needs to re-validate — that is the point of the value object.
 */

import { fail, succeed, type Result } from '../result';
import { bookFromAny, bookFromNumber } from './book-lookup';
import type { CanonicalBook } from './canonical-book.types';
import { scriptureError, type ScriptureError } from './scripture-error';
import type { VerseReference } from './verse-reference.types';

/** Multiplier for the book component of the packed integer. */
const BOOK_FACTOR = 1_000_000;

/** Multiplier for the chapter component, and the exclusive ceiling of both components. */
const CHAPTER_FACTOR = 1_000;

/** Highest chapter or verse the encoding can hold. Psalm 119, the longest, has 176. */
const MAX_COMPONENT = CHAPTER_FACTOR - 1;

/** Separates the three parts of an OSIS id, e.g. the dots in `1John.4.9`. */
export const OSIS_SEPARATOR = '.';

/**
 * A validated pointer to exactly one verse.
 *
 * Construct it with {@link makeVerseKey} or {@link verseKeyFromNumber}; the interface is
 * deliberately not constructible by hand elsewhere in the codebase, because an
 * unvalidated `{ value: 0 }` is precisely the corruption this layer exists to prevent.
 */
export interface VerseKey {
  /** The packed integer the API stores and returns, e.g. `43003016`. */
  readonly value: number;
  /** The resolved book. Present so callers can render a name without a second lookup. */
  readonly book: CanonicalBook;
  /** 1-based chapter, guaranteed within the book's chapter count. */
  readonly chapter: number;
  /** 1-based verse, guaranteed within the encoding's range. */
  readonly verse: number;
}

/**
 * Check a chapter against the book it claims to be in.
 *
 * @param book - The resolved book.
 * @param chapter - The candidate chapter number.
 * @returns `null` when valid, otherwise the error to return. Side effects: none.
 */
function chapterRangeError(book: CanonicalBook, chapter: number): ScriptureError | null {
  if (Number.isInteger(chapter) && chapter >= 1 && chapter <= book.chapterCount) {
    return null;
  }

  return scriptureError(
    'CHAPTER_OUT_OF_RANGE',
    `${book.name} has ${book.chapterCount} chapters; ${chapter} is not one of them.`,
    chapter,
  );
}

/**
 * Check a verse against what the packed encoding can represent.
 *
 * KJV verse counts per chapter are not part of this table, so this bounds the encoding
 * rather than the text. A verse past the end of a real chapter is caught when the API
 * returns no text for it.
 *
 * @param verse - The candidate verse number.
 * @returns `null` when valid, otherwise the error to return. Side effects: none.
 */
function verseRangeError(verse: number): ScriptureError | null {
  if (Number.isInteger(verse) && verse >= 1 && verse <= MAX_COMPONENT) {
    return null;
  }

  return scriptureError(
    'VERSE_OUT_OF_RANGE',
    `Verse must be a whole number from 1 to ${MAX_COMPONENT}.`,
    verse,
  );
}

/**
 * Build a verse key from its parts.
 *
 * @param book - Anything {@link bookFromAny} accepts: name, OSIS code, alias, or number.
 * @param chapter - 1-based chapter, validated against the book's chapter count.
 * @param verse - 1-based verse.
 * @returns The validated key, or the first error encountered. Side effects: none.
 *
 * @example
 * makeVerseKey('John', 3, 16);   // ok: value 43003016
 * makeVerseKey('Psalms', 151, 1); // error: CHAPTER_OUT_OF_RANGE
 */
export function makeVerseKey(
  book: string | number,
  chapter: number,
  verse: number,
): Result<VerseKey, ScriptureError> {
  const resolvedBook = bookFromAny(book);
  if (!resolvedBook.ok) {
    return resolvedBook;
  }

  const chapterError = chapterRangeError(resolvedBook.value, chapter);
  if (chapterError !== null) {
    return fail(chapterError);
  }

  const verseError = verseRangeError(verse);
  if (verseError !== null) {
    return fail(verseError);
  }

  const value = resolvedBook.value.canonicalNumber * BOOK_FACTOR + chapter * CHAPTER_FACTOR + verse;

  return succeed({ value, book: resolvedBook.value, chapter, verse });
}

/**
 * Decode a packed integer produced by the API back into a verse key.
 *
 * @param value - The `verse_key` integer, e.g. `43003016`.
 * @returns The validated key, or an error if any component is out of range.
 *
 * Side effects: none.
 *
 * @example
 * verseKeyFromNumber(43003016); // ok: John 3:16
 * verseKeyFromNumber(3016);     // error: BOOK_NUMBER_OUT_OF_RANGE (book 0)
 */
export function verseKeyFromNumber(value: number): Result<VerseKey, ScriptureError> {
  if (!Number.isInteger(value) || value < 0) {
    return fail(
      scriptureError('MALFORMED_REFERENCE', 'A verse key must be a non-negative integer.', value),
    );
  }

  const bookNumber = Math.floor(value / BOOK_FACTOR);
  const resolvedBook = bookFromNumber(bookNumber);
  if (!resolvedBook.ok) {
    return resolvedBook;
  }

  const chapter = Math.floor(value / CHAPTER_FACTOR) % CHAPTER_FACTOR;
  const verse = value % CHAPTER_FACTOR;

  return makeVerseKey(bookNumber, chapter, verse);
}

/**
 * Render the OSIS id the API uses in paths and cross-reference payloads.
 *
 * @param key - A validated verse key.
 * @returns The OSIS id, e.g. `1John.4.9`. Side effects: none.
 */
export function formatOsisId(key: VerseKey): string {
  return [key.book.osis, key.chapter, key.verse].join(OSIS_SEPARATOR);
}

/**
 * Widen a verse key into the reference shape the display formatter takes.
 *
 * @param key - A validated verse key.
 * @returns A single-verse reference. Side effects: none.
 */
export function toVerseReference(key: VerseKey): VerseReference {
  return { book: key.book, chapter: key.chapter, verse: key.verse };
}
