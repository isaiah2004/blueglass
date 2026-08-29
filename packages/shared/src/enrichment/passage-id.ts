/**
 * The pre-computed passage identifier — `ACTS_16_11_15`.
 *
 * Purpose
 *   `docs/product/prd.md` §11 keys every pre-computed record by a `passage_id` of that
 *   shape. It is the filename of a cached record, a CDN path segment, and an analytics
 *   dimension, so it has to be produced one way and parsed strictly — a record written
 *   under `ACTS_16_11_15` and looked up as `Acts_16_11_15` is a silent cache miss and a
 *   re-run of the pipeline the pre-computation exists to avoid.
 *
 * Key responsibilities
 *   - Format a book, chapter, and verse span into the canonical identifier.
 *   - Parse one back, rejecting anything that is not exactly four parts.
 *
 * Dependencies
 *   `../result`, `../scripture`. Pure: no filesystem, no network.
 *
 * Format decision (assumption, recorded as `Q-019`)
 *   The PRD's single worked example is `ACTS_16_11_15`, where `ACTS` is both the book's
 *   name and its OSIS code uppercased, so the example cannot distinguish the two. This
 *   module formats with the **uppercased OSIS code** — `1COR_13_1_13`, not
 *   `1CORINTHIANS_13_1_13` — because OSIS is already the API's book identity and keeps
 *   the id short. Parsing is tolerant of either, so a record authored the other way
 *   still resolves.
 */

import { fail, succeed, type Result } from '../result';
import {
  bookFromAny,
  makeVerseKey,
  scriptureError,
  type CanonicalBook,
  type ScriptureError,
} from '../scripture';

/** Separates the four parts of a passage id. */
const PASSAGE_ID_SEPARATOR = '_';

/** Book, chapter, first verse, last verse. */
const PASSAGE_ID_PART_COUNT = 4;

/** A parsed, validated pre-computed passage identifier. */
export interface PassageId {
  /** The canonical string form, e.g. `ACTS_16_11_15`. */
  readonly value: string;
  /** The resolved book. */
  readonly book: CanonicalBook;
  /** 1-based chapter, validated against the book's chapter count. */
  readonly chapter: number;
  /** First verse of the span. */
  readonly startVerse: number;
  /** Last verse of the span. Equal to `startVerse` for a single-verse record. */
  readonly endVerse: number;
}

/**
 * Build the canonical string form of a passage id.
 *
 * @param book - The resolved book.
 * @param chapter - 1-based chapter.
 * @param startVerse - First verse of the span.
 * @param endVerse - Last verse of the span.
 * @returns The identifier, e.g. `ACTS_16_11_15`. Side effects: none.
 */
export function formatPassageId(
  book: CanonicalBook,
  chapter: number,
  startVerse: number,
  endVerse: number,
): string {
  return [book.osis.toUpperCase(), chapter, startVerse, endVerse].join(PASSAGE_ID_SEPARATOR);
}

/**
 * Read one part of a passage id as a positive whole number.
 *
 * @param token - The raw part.
 * @returns The number, or `null` when the part is not all digits.
 */
function readWholeNumber(token: string): number | null {
  return /^\d+$/.test(token) ? Number(token) : null;
}

/**
 * Validate the two verse numbers of a span against the book and each other.
 *
 * @param book - The resolved book, for the chapter bound.
 * @param chapter - The candidate chapter.
 * @param startVerse - First verse of the span.
 * @param endVerse - Last verse of the span.
 * @param raw - The original identifier, echoed into any error.
 * @returns `null` when the span is valid, otherwise the error to return.
 */
function spanError(
  book: CanonicalBook,
  chapter: number,
  startVerse: number,
  endVerse: number,
  raw: string,
): ScriptureError | null {
  const start = makeVerseKey(book.canonicalNumber, chapter, startVerse);
  if (!start.ok) {
    return start.error;
  }

  const end = makeVerseKey(book.canonicalNumber, chapter, endVerse);
  if (!end.ok) {
    return end.error;
  }

  if (endVerse < startVerse) {
    return scriptureError(
      'MALFORMED_REFERENCE',
      'A passage id must not end before it starts.',
      raw,
    );
  }

  return null;
}

/**
 * Parse a pre-computed passage identifier.
 *
 * @param raw - The identifier, e.g. `ACTS_16_11_15`. Case-insensitive in the book part.
 * @returns The parsed id, or a structured error. Side effects: none.
 *
 * @example
 * parsePassageId('ACTS_16_11_15'); // ok: Acts 16:11-15
 * parsePassageId('ACTS_16_11');    // error: MALFORMED_REFERENCE — four parts required
 */
export function parsePassageId(raw: string): Result<PassageId, ScriptureError> {
  const parts = raw.trim().split(PASSAGE_ID_SEPARATOR);

  if (parts.length !== PASSAGE_ID_PART_COUNT) {
    return fail(
      scriptureError(
        'MALFORMED_REFERENCE',
        'A passage id must read BOOK_CHAPTER_STARTVERSE_ENDVERSE.',
        raw,
      ),
    );
  }

  const [bookToken = '', chapterToken = '', startToken = '', endToken = ''] = parts;
  const chapter = readWholeNumber(chapterToken);
  const startVerse = readWholeNumber(startToken);
  const endVerse = readWholeNumber(endToken);

  if (chapter === null || startVerse === null || endVerse === null) {
    return fail(
      scriptureError(
        'MALFORMED_REFERENCE',
        'Chapter and verses of a passage id must be numbers.',
        raw,
      ),
    );
  }

  const book = bookFromAny(bookToken);
  if (!book.ok) {
    return book;
  }

  const invalidSpan = spanError(book.value, chapter, startVerse, endVerse, raw);
  if (invalidSpan !== null) {
    return fail(invalidSpan);
  }

  return succeed({
    value: formatPassageId(book.value, chapter, startVerse, endVerse),
    book: book.value,
    chapter,
    startVerse,
    endVerse,
  });
}
