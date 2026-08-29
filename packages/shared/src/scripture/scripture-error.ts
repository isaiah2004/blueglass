/**
 * Structured failures produced by the scripture domain.
 *
 * Purpose
 *   Every scripture parser returns `Result<T, ScriptureError>` (see `../result`). This
 *   module defines the failure arm: a machine-readable `code` the UI can switch on, a
 *   human-readable `message` for a toast or an inline hint, and the offending `input`
 *   echoed back so a log line or a bug report is self-contained.
 *
 * Key responsibilities
 *   - Enumerate every way resolving a book or a verse key can legitimately fail.
 *   - Build those errors, so no call site hand-writes an error object or a bare string.
 *
 * Dependencies
 *   None. Pure data; no logger, no I/O — the domain layer has zero infrastructure
 *   imports and callers decide whether a failure is worth logging.
 *
 * Note
 *   The codes mirror the shape rule 6.3.2 requires of API errors (`error_code` +
 *   `message` + `details`) so a domain failure can be surfaced over HTTP unchanged.
 */

/**
 * Why a scripture value could not be produced.
 *
 * - `UNKNOWN_BOOK` — the token is not a canonical name, an OSIS code, or a known alias.
 * - `BOOK_NUMBER_OUT_OF_RANGE` — a numeric book outside 1..66 (the classic `0` bug).
 * - `CHAPTER_OUT_OF_RANGE` — chapter < 1 or past the book's KJV chapter count.
 * - `VERSE_OUT_OF_RANGE` — verse < 1 or past the verse-key encoding's 999 ceiling.
 * - `MALFORMED_REFERENCE` — the string is not shaped like a reference at all.
 */
export type ScriptureErrorCode =
  | 'UNKNOWN_BOOK'
  | 'BOOK_NUMBER_OUT_OF_RANGE'
  | 'CHAPTER_OUT_OF_RANGE'
  | 'VERSE_OUT_OF_RANGE'
  | 'MALFORMED_REFERENCE';

/** A scripture failure, safe to render, log, or return over the wire. */
export interface ScriptureError {
  /** Machine-readable discriminator. Switch on this, never on `message`. */
  readonly code: ScriptureErrorCode;
  /** One sentence explaining the failure to a developer or a reader. */
  readonly message: string;
  /** The rejected input, stringified. Never contains user content beyond the token. */
  readonly input: string;
}

/**
 * Build a scripture error.
 *
 * @param code - The machine-readable discriminator.
 * @param message - One sentence explaining what went wrong.
 * @param input - The rejected input; numbers are stringified.
 * @returns The structured error. Side effects: none.
 */
export function scriptureError(
  code: ScriptureErrorCode,
  message: string,
  input: string | number,
): ScriptureError {
  return { code, message, input: String(input) };
}
