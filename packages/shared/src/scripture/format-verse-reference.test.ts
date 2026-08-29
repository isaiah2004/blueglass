/**
 * Behaviour tests for `formatVerseReference`.
 *
 * Purpose
 *   Prove the four representable forms of a `VerseReference` each render the way a
 *   reader expects, and that a degenerate range collapses instead of printing
 *   "Acts 16:14-14".
 *
 * Note
 *   This is also the workspace's proof that the Vitest runner is wired up — if this
 *   file stops running, the test harness is broken, not just this helper.
 */

import { describe, expect, it } from 'vitest';

import { formatVerseReference } from './format-verse-reference';
import type { BibleBook } from './verse-reference.types';

/** Acts — the book the 30-day MVP reading plan is built on (`docs/product/prd.md`). */
const ACTS: BibleBook = {
  id: 'acts',
  name: 'Acts',
  canonicalNumber: 44,
  chapterCount: 28,
};

describe('formatVerseReference', () => {
  it('renders a whole-chapter reference without a verse number', () => {
    const reference = { book: ACTS, chapter: 16 };

    const formatted = formatVerseReference(reference);

    expect(formatted).toBe('Acts 16');
  });

  it('renders a single-verse reference as chapter:verse', () => {
    const reference = { book: ACTS, chapter: 16, verse: 14 };

    const formatted = formatVerseReference(reference);

    expect(formatted).toBe('Acts 16:14');
  });

  it('renders an inclusive verse range with a hyphen', () => {
    const reference = { book: ACTS, chapter: 16, verse: 14, endVerse: 15 };

    const formatted = formatVerseReference(reference);

    expect(formatted).toBe('Acts 16:14-15');
  });

  it('collapses a range that ends on its own start verse', () => {
    const reference = { book: ACTS, chapter: 16, verse: 14, endVerse: 14 };

    const formatted = formatVerseReference(reference);

    expect(formatted).toBe('Acts 16:14');
  });
});
