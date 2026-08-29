/**
 * Behaviour tests for the pre-computed passage identifier.
 *
 * Purpose
 *   A passage id is a cache key. A parse that is too lenient produces two ids for one
 *   passage and silently re-runs the editorial pipeline the pre-computation exists to
 *   avoid (`docs/product/prd.md` §11). These tests pin both directions against the
 *   spec's only worked example, `ACTS_16_11_15`.
 */

import { describe, expect, it } from 'vitest';

import { bookFromAny } from '../scripture';
import { unwrapError, unwrapValue } from '../testing/unwrap-result';
import { formatPassageId, parsePassageId } from './passage-id';

/** The identifier the PRD prints in its schema example. */
const ACTS_16_11_15 = 'ACTS_16_11_15';

describe('parsing a passage id', () => {
  it('parses the PRD worked example into its parts', () => {
    const passage = unwrapValue(parsePassageId(ACTS_16_11_15));

    expect(passage.book.name).toBe('Acts');
    expect(passage.chapter).toBe(16);
    expect(passage.startVerse).toBe(11);
    expect(passage.endVerse).toBe(15);
  });

  it('normalises the book part, so one passage has exactly one id', () => {
    expect(unwrapValue(parsePassageId('acts_16_11_15')).value).toBe(ACTS_16_11_15);
    expect(unwrapValue(parsePassageId('Acts_16_11_15')).value).toBe(ACTS_16_11_15);
  });

  it('accepts a book part written as the full name rather than the OSIS code', () => {
    expect(unwrapValue(parsePassageId('1CORINTHIANS_13_1_13')).value).toBe('1COR_13_1_13');
  });

  it('accepts a single-verse record written as a degenerate span', () => {
    const passage = unwrapValue(parsePassageId('JOHN_3_16_16'));

    expect(passage.startVerse).toBe(16);
    expect(passage.endVerse).toBe(16);
  });

  it('rejects an id with only three parts', () => {
    expect(unwrapError(parsePassageId('ACTS_16_11')).code).toBe('MALFORMED_REFERENCE');
  });

  it('rejects an id with five parts', () => {
    expect(unwrapError(parsePassageId('ACTS_16_11_15_1')).code).toBe('MALFORMED_REFERENCE');
  });

  it('rejects non-numeric chapter or verse parts', () => {
    expect(unwrapError(parsePassageId('ACTS_XVI_11_15')).code).toBe('MALFORMED_REFERENCE');
  });

  it('rejects an unknown book', () => {
    expect(unwrapError(parsePassageId('HEZEK_1_1_2')).code).toBe('UNKNOWN_BOOK');
  });

  it('rejects a chapter past the end of the book', () => {
    expect(unwrapError(parsePassageId('OBAD_2_1_2')).code).toBe('CHAPTER_OUT_OF_RANGE');
  });

  it('rejects verse 0', () => {
    expect(unwrapError(parsePassageId('ACTS_16_0_15')).code).toBe('VERSE_OUT_OF_RANGE');
  });

  it('rejects a span that ends before it starts', () => {
    expect(unwrapError(parsePassageId('ACTS_16_15_11')).code).toBe('MALFORMED_REFERENCE');
  });
});

describe('formatting a passage id', () => {
  it('reproduces the PRD worked example', () => {
    const acts = unwrapValue(bookFromAny('Acts'));

    expect(formatPassageId(acts, 16, 11, 15)).toBe(ACTS_16_11_15);
  });

  it('uses the uppercased OSIS code for a numbered book', () => {
    const firstCorinthians = unwrapValue(bookFromAny('1 Corinthians'));

    expect(formatPassageId(firstCorinthians, 13, 1, 13)).toBe('1COR_13_1_13');
  });

  it('round-trips through the parser', () => {
    const parsed = unwrapValue(parsePassageId(ACTS_16_11_15));

    expect(formatPassageId(parsed.book, parsed.chapter, parsed.startVerse, parsed.endVerse)).toBe(
      ACTS_16_11_15,
    );
  });
});
