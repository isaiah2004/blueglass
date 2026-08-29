/**
 * Turning a verse key into something a reader can read and a router can navigate to.
 *
 * Purpose
 *   Three of this folder's surfaces send the reader somewhere — a cross-reference row, a
 *   Root example, a History passage span. All three need the same two things: the
 *   reference as a string, and a destination the host can hand to Expo Router. Doing that
 *   arithmetic once means the same passage can never appear as "Acts 2:38-39" in one place
 *   and "Acts 2:38–2:39" in another.
 *
 * Key responsibilities
 *   - Format a single verse and an inclusive span, including a span that crosses a chapter
 *     or a book (637 published cross-reference ranges cross a chapter — see the API's
 *     `crossref.py`).
 *   - Describe a destination as data, so no component in this folder imports a navigator.
 *
 * Why navigation is a callback and not a router call
 *   These sheets render in two different homes: a bottom sheet on a phone and the context
 *   rail beside the text on a tablet. The rail's host may want to move the reading canvas
 *   without dismissing anything, the sheet's host must dismiss first. That is the host's
 *   decision, so this layer only says *where*.
 *
 * Dependencies
 *   `@atlas/shared`. Pure — no React, no router, Node-testable.
 */

import {
  formatVerseReference,
  parseOsisPoint,
  toVerseReference,
  verseKeyFromNumber,
  type VerseKey,
  type VerseKeyRange,
} from '@atlas/shared';

/** Separates the two halves of a span whose ends are in different chapters. */
const CROSS_CHAPTER_SEPARATOR = '–';

/**
 * Where a tap on a reference should take the reader.
 *
 * Deliberately flat and primitive: the host turns it into route params, and a route param
 * is a string. Carrying the `VerseKey` as well means the host can also scroll to and
 * highlight the verse without decoding the id a second time.
 */
export interface VerseTarget {
  /** The verse to open. */
  readonly verse: VerseKey;
  /** Route segment for the book, e.g. `acts`. Matches `CanonicalBook.id`. */
  readonly bookId: string;
  /** 1-based chapter. */
  readonly chapter: number;
  /** 1-based verse, for focusing the row once the chapter is on screen. */
  readonly verseNumber: number;
  /** How the destination reads, e.g. `Acts 16:14`. Used as the accessibility label. */
  readonly label: string;
}

/**
 * Format one verse.
 *
 * @param verse - The verse to name.
 * @returns The reference, e.g. `Acts 16:14`. Side effects: none.
 */
export function verseLabel(verse: VerseKey): string {
  return formatVerseReference(toVerseReference(verse));
}

/**
 * Format an inclusive span of verses.
 *
 * A span inside one chapter collapses to `Acts 2:38-39`; a span that leaves its chapter or
 * its book prints both ends in full, because `Acts 16:6-40` and `Acts 16:6 – Acts 17:2` are
 * different claims and the short form cannot express the second.
 *
 * @param range - The span, both endpoints inclusive.
 * @returns The reference. Side effects: none.
 *
 * @example
 * passageLabel({ start: acts2v38, end: acts2v39 }); // 'Acts 2:38-39'
 */
export function passageLabel(range: VerseKeyRange): string {
  const { start, end } = range;
  const sameChapter =
    start.book.canonicalNumber === end.book.canonicalNumber && start.chapter === end.chapter;

  if (sameChapter) {
    return formatVerseReference({
      book: start.book,
      chapter: start.chapter,
      verse: start.verse,
      endVerse: end.verse,
    });
  }

  if (start.value === end.value) {
    return verseLabel(start);
  }

  return `${verseLabel(start)}${CROSS_CHAPTER_SEPARATOR}${verseLabel(end)}`;
}

/**
 * Describe where a tap on one verse should go.
 *
 * @param verse - The verse to open.
 * @param label - Optional override for the label, e.g. the reference string the API
 *   already printed for a cross-reference span. Defaults to this verse's own reference.
 * @returns The destination. Side effects: none.
 */
export function verseTarget(verse: VerseKey, label?: string): VerseTarget {
  return {
    verse,
    bookId: verse.book.id,
    chapter: verse.chapter,
    verseNumber: verse.verse,
    label: label ?? verseLabel(verse),
  };
}

/**
 * Describe where a tap on a span should go: its first verse.
 *
 * Opening the start of a span rather than its middle is the only choice that never
 * surprises — the reader asked for `Acts 2:38-39` and lands on verse 38 with 39 below it.
 *
 * @param range - The span.
 * @param label - Optional override, normally the API's own `displayReference`.
 * @returns The destination. Side effects: none.
 */
export function rangeTarget(range: VerseKeyRange, label?: string): VerseTarget {
  return verseTarget(range.start, label ?? passageLabel(range));
}

/**
 * Whether a span covers more than the one verse whose text a payload carries.
 *
 * The API populates a cross-reference target's `text` from the FIRST verse of the span
 * only. A reader shown two verses' worth of reference and one verse's worth of text is
 * owed that distinction, so the sheets mark it rather than letting the text look complete.
 *
 * @param range - The span.
 * @returns True when the span holds more than one verse. Side effects: none.
 */
export function spansMultipleVerses(range: VerseKeyRange): boolean {
  return range.end.value > range.start.value;
}

/**
 * Describe where a tap on an OSIS id should go, for the two payloads that carry OSIS ids
 * instead of a resolved `VerseKey` — a `[Lineage]` person's introduction and a messianic
 * prophecy's location (`literary-badge.types.ts`).
 *
 * @param osis - An OSIS point reference, e.g. `1Sam.16.13`.
 * @param label - Optional override for the destination's label.
 * @returns The destination, or `undefined` when the id does not parse — a lineage row with
 *   an unparsable id is shown without a jump-to-verse action rather than dropped, since the
 *   name and relationship are still true even when the reference is not actionable.
 *   Side effects: none.
 */
export function osisTarget(osis: string, label?: string): VerseTarget | undefined {
  const result = parseOsisPoint(osis);

  return result.ok ? verseTarget(result.value, label) : undefined;
}

/**
 * Decode a packed verse key, dropping it rather than throwing when it is not one.
 *
 * The sheets take resolved `VerseKey` values, because that is what `@atlas/shared`'s badge
 * envelope declares. The wire sends packed integers. This is the adapter for a host that
 * has not decoded them yet — it lives here rather than in the host so that only one
 * definition of "a bad key is skipped, never rendered" exists.
 *
 * @param value - The packed integer, e.g. `44016014`.
 * @returns The decoded key, or `undefined` when the integer names no real verse.
 *   Side effects: none.
 */
export function decodeVerseKey(value: number): VerseKey | undefined {
  const result = verseKeyFromNumber(value);

  return result.ok ? result.value : undefined;
}

/**
 * Decode a packed span.
 *
 * @param startKey - Packed key of the first verse.
 * @param endKey - Packed key of the last verse, inclusive.
 * @returns The span, or `undefined` when either end fails to decode. Both are required:
 *   half a span would silently narrow the passage a reader is shown. Side effects: none.
 */
export function decodeVerseRange(startKey: number, endKey: number): VerseKeyRange | undefined {
  const start = decodeVerseKey(startKey);
  const end = decodeVerseKey(endKey);

  return start === undefined || end === undefined ? undefined : { start, end };
}
