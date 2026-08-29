/**
 * Behaviour tests for OSIS reference parsing.
 *
 * Purpose
 *   OSIS strings arrive from the network (`cross_references[].osis`) and from AI
 *   citations, so this parser is a system boundary. These tests pin the forms the API
 *   actually emits — including the segment-letter suffix its own parser tolerates — and
 *   prove that malformed input becomes a described failure rather than a wrong verse.
 */

import { describe, expect, it } from 'vitest';

import { unwrapError, unwrapValue } from '../testing/unwrap-result';
import { parseOsisPoint, parseOsisRange } from './osis-reference';
import { formatOsisId } from './verse-key';

describe('parsing a single OSIS point', () => {
  it('parses the canonical example, John.3.16', () => {
    const key = unwrapValue(parseOsisPoint('John.3.16'));

    expect(key.value).toBe(43003016);
  });

  it('parses a numbered book whose OSIS code has no space', () => {
    expect(unwrapValue(parseOsisPoint('1John.4.9')).book.name).toBe('1 John');
  });

  it('drops the segment letter the API tolerates on a verse, Gen.1.1a', () => {
    const key = unwrapValue(parseOsisPoint('Gen.1.1a'));

    expect(key.chapter).toBe(1);
    expect(key.verse).toBe(1);
  });

  it('ignores surrounding whitespace', () => {
    expect(unwrapValue(parseOsisPoint('  Prov.1.1  ')).book.name).toBe('Proverbs');
  });

  it('round-trips every point back to the same string through formatOsisId', () => {
    for (const reference of ['Gen.1.1', 'Ps.119.176', 'Song.8.14', '2John.1.1', 'Rev.22.21']) {
      expect(formatOsisId(unwrapValue(parseOsisPoint(reference)))).toBe(reference);
    }
  });

  it('rejects a reference missing its verse', () => {
    expect(unwrapError(parseOsisPoint('John.3')).code).toBe('MALFORMED_REFERENCE');
  });

  it('rejects a reference with too many parts', () => {
    expect(unwrapError(parseOsisPoint('John.3.16.2')).code).toBe('MALFORMED_REFERENCE');
  });

  it('rejects a non-numeric chapter', () => {
    expect(unwrapError(parseOsisPoint('John.three.16')).code).toBe('MALFORMED_REFERENCE');
  });

  it('rejects an unknown book code without guessing', () => {
    expect(unwrapError(parseOsisPoint('Hezek.1.1')).code).toBe('UNKNOWN_BOOK');
  });

  it('rejects a chapter past the end of the book', () => {
    expect(unwrapError(parseOsisPoint('Obad.2.1')).code).toBe('CHAPTER_OUT_OF_RANGE');
  });

  it('rejects an empty string', () => {
    expect(unwrapError(parseOsisPoint('')).code).toBe('MALFORMED_REFERENCE');
  });
});

describe('parsing an OSIS range', () => {
  it('parses the two endpoints of a cross-reference span', () => {
    const range = unwrapValue(parseOsisRange('1John.4.9-1John.4.10'));

    expect(range.start.verse).toBe(9);
    expect(range.end.verse).toBe(10);
  });

  it('treats a single point as a range of one verse', () => {
    const range = unwrapValue(parseOsisRange('John.3.16'));

    expect(range.start.value).toBe(range.end.value);
  });

  it('spans chapters and books', () => {
    const range = unwrapValue(parseOsisRange('Mal.4.6-Matt.1.1'));

    expect(range.start.book.name).toBe('Malachi');
    expect(range.end.book.name).toBe('Matthew');
  });

  it('reports the failing endpoint when the second one is malformed', () => {
    expect(unwrapError(parseOsisRange('John.3.16-John.3')).code).toBe('MALFORMED_REFERENCE');
  });

  it('rejects a range that ends before it starts', () => {
    const error = unwrapError(parseOsisRange('John.3.18-John.3.16'));

    expect(error.code).toBe('MALFORMED_REFERENCE');
    expect(error.message).toContain('end before it starts');
  });
});
