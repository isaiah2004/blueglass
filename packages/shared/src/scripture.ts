/**
 * The scripture domain's public surface.
 *
 * Purpose
 *   One import for everything about "where in the Bible": the canonical 66-book table,
 *   the resolvers that turn any spelling of a book into a canonical row, the `VerseKey`
 *   value object, and the OSIS parsers. Consumers import from here (or from
 *   `@atlas/shared`) and never reach into `scripture/*` directly (rule 5.3.3).
 *
 * Why this file sits beside a folder of the same name
 *   The implementation is split across `scripture/` because no file may exceed 300
 *   lines (CLAUDE.md, "Hard limits"). This module is the barrel for that folder, so the
 *   split stays an internal detail: moving a function between those files never changes
 *   an import anywhere else.
 *
 * Dependencies
 *   Only its own folder. Zero infrastructure imports — no React, no fetch, no storage.
 */

export type { BookNumber, CanonicalBook, Testament } from './scripture/canonical-book.types';
export type { BibleBook, Translation, VerseReference } from './scripture/verse-reference.types';
export type { ScriptureError, ScriptureErrorCode } from './scripture/scripture-error';
export type { VerseKey } from './scripture/verse-key';
export type { VerseKeyRange } from './scripture/osis-reference';

export { CANONICAL_BOOK_COUNT, CANONICAL_BOOKS } from './scripture/books.data';
export { bookFromAny, bookFromNumber, bookNumberFromAny } from './scripture/book-lookup';
export { isBookNumberToken, normaliseBookToken } from './scripture/book-token';
export { formatVerseReference } from './scripture/format-verse-reference';
export { parseOsisPoint, parseOsisRange } from './scripture/osis-reference';
export { scriptureError } from './scripture/scripture-error';
export {
  formatOsisId,
  makeVerseKey,
  OSIS_SEPARATOR,
  toVerseReference,
  verseKeyFromNumber,
} from './scripture/verse-key';
