/**
 * Verse reference formatting.
 *
 * Purpose
 *   Turn a structured `VerseReference` into the string a reader recognises
 *   ("John 3:16-18"). Every surface that prints a reference — verse gutters, note
 *   cards, AI source chips, share sheets — must call this, so one passage never
 *   appears two different ways in the same screen.
 *
 * Key responsibilities
 *   - Render whole-chapter, single-verse, and verse-range references.
 *   - Collapse a degenerate range (start === end) to a single verse.
 *
 * Dependencies
 *   `./verse-reference.types` only. Pure: no I/O, no clock, no locale lookups.
 *
 * Usage
 *   ```ts
 *   import { formatVerseReference } from '@atlas/shared';
 *
 *   formatVerseReference({ book: john, chapter: 3, verse: 16 }); // 'John 3:16'
 *   ```
 */

import type { VerseReference } from './verse-reference.types';

/** Separates chapter from verse, e.g. the ":" in "John 3:16". */
const CHAPTER_VERSE_SEPARATOR = ':';

/** Separates the ends of an inclusive verse range, e.g. the "-" in "John 3:16-18". */
const VERSE_RANGE_SEPARATOR = '-';

/**
 * Render a verse reference as display text.
 *
 * @param reference - The passage to render. `verse` and `endVerse` are optional; see
 *                    {@link VerseReference} for the four representable forms.
 * @returns The reference as a reader-facing string. Never empty.
 *
 * Side effects: none.
 *
 * @example
 * formatVerseReference({ book: acts, chapter: 16 });                        // 'Acts 16'
 * formatVerseReference({ book: acts, chapter: 16, verse: 14 });             // 'Acts 16:14'
 * formatVerseReference({ book: acts, chapter: 16, verse: 14, endVerse: 15 });// 'Acts 16:14-15'
 */
export function formatVerseReference(reference: VerseReference): string {
  const { book, chapter, verse, endVerse } = reference;
  const chapterText = `${book.name} ${chapter}`;

  if (verse === undefined) {
    return chapterText;
  }

  const verseText = `${chapterText}${CHAPTER_VERSE_SEPARATOR}${verse}`;

  // A range whose end is not past its start is the same passage as the start verse.
  // Callers build ranges from user selections, so this collapse is expected, not an error.
  if (endVerse === undefined || endVerse <= verse) {
    return verseText;
  }

  return `${verseText}${VERSE_RANGE_SEPARATOR}${endVerse}`;
}
