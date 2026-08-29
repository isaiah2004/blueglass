/**
 * Rendering the wire's packed verse keys as a reference a reader recognises.
 *
 * Purpose
 *   `RoutePayloadOut.passage` is `{start_key, end_key}` — two packed integers such as
 *   `44016001`. A sheet has to print "Acts 16:1-14". Resolving a packed key needs the
 *   canonical book table, which lives in `@atlas/shared`, so this is a three-line job that
 *   nonetheless has four failure modes and therefore has its own module and its own tests.
 *
 * What it will not do
 *   Guess. A key that does not resolve produces `null`, and every call site treats that as
 *   "print no reference" rather than printing the raw integer. A reader shown `44016001`
 *   learns nothing and is told, falsely, that the app knows what it is talking about.
 *
 * Dependencies
 *   `@atlas/shared`. No React.
 */

import {
  bookFromAny,
  formatVerseReference,
  toVerseReference,
  verseKeyFromNumber,
} from '@atlas/shared';

import type { PassageKeys } from './spatial-payload.types';

/** Separates the two ends of a span that crosses a chapter or a book. */
const SPAN_SEPARATOR = ' – ';

/** Separates the two verse numbers of a span inside one chapter. */
const VERSE_SEPARATOR = '-';

/**
 * Render one packed verse key.
 *
 * @param key - A packed key such as `44016011`.
 * @returns `Acts 16:11`, or `null` when the key names no verse of the canon.
 *   Side effects: none.
 */
export function formatVerseKey(key: number): string | null {
  const resolved = verseKeyFromNumber(key);
  return resolved.ok ? formatVerseReference(toVerseReference(resolved.value)) : null;
}

/**
 * Render an inclusive span of verses.
 *
 * @param passage - The two packed keys the wire sends.
 * @returns `Acts 16:1-14` when both ends share a book and chapter, `Acts 16:40 - Acts 17:1`
 *   when they do not, `Acts 16:11` when they are the same verse, and `null` when either
 *   end fails to resolve. Side effects: none.
 */
export function formatPassage(passage: PassageKeys): string | null {
  const start = verseKeyFromNumber(passage.startKey);
  const end = verseKeyFromNumber(passage.endKey);
  if (!start.ok || !end.ok) return null;

  const startText = formatVerseReference(toVerseReference(start.value));
  if (passage.startKey === passage.endKey) return startText;

  const sameChapter =
    start.value.book.canonicalNumber === end.value.book.canonicalNumber &&
    start.value.chapter === end.value.chapter;
  if (sameChapter) return `${startText}${VERSE_SEPARATOR}${end.value.verse}`;

  return `${startText}${SPAN_SEPARATOR}${formatVerseReference(toVerseReference(end.value))}`;
}

/**
 * Render an OSIS id such as `Acts.16.1` as a reference.
 *
 * The 3D City payload sends `mentioned_at` as OSIS ids rather than packed keys, because
 * that is the identity the enrichment tables are keyed by.
 *
 * The book code is resolved through the canonical table rather than printed as it arrives:
 * `1Cor.1.1` must read `1 Corinthians 1:1`, not `1Cor 1:1`.
 *
 * @param osis - An OSIS point, e.g. `Acts.16.1`.
 * @returns `Acts 16:1`, or `null` when the id does not parse or names no canonical book.
 *   Side effects: none.
 */
export function formatOsis(osis: string): string | null {
  const parts = osis.split('.');
  if (parts.length !== 3) return null;
  const book = bookFromAny(parts[0]!);
  const chapter = Number(parts[1]);
  const verse = Number(parts[2]);
  if (!book.ok || !Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
  return formatVerseReference({ book: book.value, chapter, verse });
}
