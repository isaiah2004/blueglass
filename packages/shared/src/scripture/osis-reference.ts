/**
 * Parsing OSIS references into verse keys.
 *
 * Purpose
 *   The API speaks OSIS: `GET /verses/{osis}/cross-references` takes `John.3.16`, and
 *   every cross-reference it returns carries one (`flutter-port-map.md` §7, endpoint 2).
 *   Those strings arrive from the network and from AI citations, so parsing them is a
 *   boundary operation that must reject bad input rather than guess (rule 6.5.1).
 *
 * Key responsibilities
 *   - Parse a single OSIS point into a validated `VerseKey`.
 *   - Parse an OSIS range into its inclusive endpoints.
 *
 * Dependencies
 *   `../result`, `./scripture-error`, `./verse-key`. Pure: no I/O.
 *
 * Compatibility
 *   Mirrors `server/app/scripture/refs.py` `parse_osis_point` / `parse_osis_range`,
 *   including its tolerance of a letter suffix on the verse (`Gen.1.1a`). It differs in
 *   one deliberate way: it returns a `Result` instead of raising `RefError`, and it
 *   rejects an inverted range, which the server accepts silently.
 */

import { fail, succeed, type Result } from '../result';
import { scriptureError, type ScriptureError } from './scripture-error';
import { makeVerseKey, OSIS_SEPARATOR, type VerseKey } from './verse-key';

/** Separates the two endpoints of an OSIS range, e.g. `1John.4.9-1John.4.10`. */
const OSIS_RANGE_SEPARATOR = '-';

/** How many dot-separated parts a single OSIS point has: book, chapter, verse. */
const OSIS_POINT_PART_COUNT = 3;

/** Matches one or more ASCII digits at the start of a token. */
const LEADING_DIGITS = /^\d+/;

/** An inclusive span of verses, as returned for a cross-reference target. */
export interface VerseKeyRange {
  /** First verse of the span. */
  readonly start: VerseKey;
  /** Last verse of the span. Equal to `start` for a single verse. */
  readonly end: VerseKey;
}

/**
 * Read the leading digits of a token, ignoring a trailing letter suffix.
 *
 * OSIS verses may carry a segment letter — `Gen.1.1a` — which the API strips before
 * keying. Anything that does not begin with a digit yields `null`.
 *
 * @param token - The chapter or verse fragment of an OSIS id.
 * @returns The numeric prefix, or `null` when there is none. Side effects: none.
 */
function readLeadingNumber(token: string): number | null {
  const digits = LEADING_DIGITS.exec(token);

  return digits === null ? null : Number(digits[0]);
}

/**
 * Parse a single OSIS reference into a validated verse key.
 *
 * @param reference - An OSIS point such as `John.3.16`, `Prov.1.1`, or `Gen.1.1a`.
 * @returns The verse key, or a structured error explaining the rejection.
 *
 * Side effects: none.
 *
 * @example
 * parseOsisPoint('John.3.16'); // ok: value 43003016
 * parseOsisPoint('Gen.1.1a');  // ok: the segment letter is dropped
 * parseOsisPoint('John.3');    // error: MALFORMED_REFERENCE
 */
export function parseOsisPoint(reference: string): Result<VerseKey, ScriptureError> {
  const parts = reference.trim().split(OSIS_SEPARATOR);

  if (parts.length !== OSIS_POINT_PART_COUNT) {
    return fail(
      scriptureError(
        'MALFORMED_REFERENCE',
        'An OSIS reference must read Book.Chapter.Verse.',
        reference,
      ),
    );
  }

  const [bookToken = '', chapterToken = '', verseToken = ''] = parts;
  const chapter = readLeadingNumber(chapterToken);
  const verse = readLeadingNumber(verseToken);

  if (chapter === null || verse === null) {
    return fail(
      scriptureError(
        'MALFORMED_REFERENCE',
        'The chapter and verse of an OSIS reference must be numbers.',
        reference,
      ),
    );
  }

  return makeVerseKey(bookToken, chapter, verse);
}

/**
 * Parse an OSIS reference that may name a span of verses.
 *
 * @param reference - `1John.4.9-1John.4.10`, or a single point such as `John.3.16`.
 * @returns The inclusive endpoints, or a structured error. A single point yields a range
 *          whose `start` and `end` are the same verse.
 *
 * Side effects: none.
 *
 * @example
 * parseOsisRange('1John.4.9-1John.4.10'); // ok: two distinct endpoints
 * parseOsisRange('John.3.16');            // ok: start === end
 * parseOsisRange('John.3.18-John.3.16');  // error: MALFORMED_REFERENCE (inverted)
 */
export function parseOsisRange(reference: string): Result<VerseKeyRange, ScriptureError> {
  const separatorIndex = reference.indexOf(OSIS_RANGE_SEPARATOR);

  if (separatorIndex === -1) {
    const point = parseOsisPoint(reference);

    return point.ok ? succeed({ start: point.value, end: point.value }) : point;
  }

  const start = parseOsisPoint(reference.slice(0, separatorIndex));
  if (!start.ok) {
    return start;
  }

  const end = parseOsisPoint(reference.slice(separatorIndex + 1));
  if (!end.ok) {
    return end;
  }

  if (end.value.value < start.value.value) {
    return fail(
      scriptureError(
        'MALFORMED_REFERENCE',
        'An OSIS range must not end before it starts.',
        reference,
      ),
    );
  }

  return succeed({ start: start.value, end: end.value });
}
