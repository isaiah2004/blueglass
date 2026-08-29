/**
 * Tests for the reader's failure copy.
 *
 * As much a copy review as a unit test: the three screens must stay distinguishable, no
 * sentence may leak developer detail at a reader, and every screen must offer a next step.
 */

import { httpError, malformedResponseError, networkError, timeoutError } from '@/api';
import { describe, expect, it } from 'vitest';

import { badAddressCopy, EMPTY_CHAPTER_COPY, readerStatusCopy } from './reader-status';

/** The failure the API produces when a chapter is past a book's last. */
const OUT_OF_RANGE = httpError({
  status: 422,
  code: 'chapter_out_of_range',
  message: 'John has 21 chapters; 99 is out of range.',
  details: { book: 'John', chapter: 99 },
  requestId: '5896d199107a4453a578cbaa97c16be2',
});

const FAILURES = {
  timeout: timeoutError(10_000),
  network: networkError(new TypeError('Failed to fetch')),
  malformed: malformedResponseError('chapter.verses[3].verse_key', 'a number'),
  serverFault: httpError({ status: 500, code: 'internal_error', message: 'boom' }),
  wrongAddress: OUT_OF_RANGE,
} as const;

describe('readerStatusCopy', () => {
  it('treats every unreachable-network failure as one screen', () => {
    expect(readerStatusCopy(FAILURES.timeout).tone).toBe('offline');
    expect(readerStatusCopy(FAILURES.network).tone).toBe('offline');
    expect(readerStatusCopy(FAILURES.timeout)).toEqual(readerStatusCopy(FAILURES.network));
  });

  it('keeps a wrong address distinct from a server fault', () => {
    expect(readerStatusCopy(FAILURES.wrongAddress).tone).toBe('notFound');
    expect(readerStatusCopy(FAILURES.serverFault).tone).toBe('error');
    expect(readerStatusCopy(FAILURES.wrongAddress).title).not.toBe(
      readerStatusCopy(FAILURES.serverFault).title,
    );
  });

  it.each(['book_not_found', 'chapter_not_found', 'translation_not_found'])(
    'reads %s as a wrong address whatever status carried it',
    (code) => {
      const failure = httpError({ status: 500, code, message: 'Unknown book.' });
      expect(readerStatusCopy(failure).tone).toBe('notFound');
    },
  );

  it('keeps the server’s specific sentence for a wrong address', () => {
    expect(readerStatusCopy(OUT_OF_RANGE).body).toBe('John has 21 chapters; 99 is out of range.');
  });

  it('does NOT show the server’s sentence for a fault — it is written for an operator', () => {
    expect(readerStatusCopy(FAILURES.serverFault).body).not.toContain('boom');
  });

  it('always writes a complete, non-empty sentence', () => {
    for (const failure of Object.values(FAILURES)) {
      const copy = readerStatusCopy(failure);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body).toMatch(/[.!?]$/);
    }
  });

  it('never shows a reader a status code, a URL, a request id, or a decoder path', () => {
    const forbidden = [/https?:\/\//, /\b[45]\d{2}\b/, /request[_ ]id/i, /verses\[/, /\bnull\b/];
    for (const failure of Object.values(FAILURES)) {
      const copy = readerStatusCopy(failure);
      for (const pattern of forbidden) {
        expect(`${copy.title} ${copy.body}`).not.toMatch(pattern);
      }
    }
  });

  it('offers Retry where retrying could help, and a way out where it could not', () => {
    expect(readerStatusCopy(FAILURES.timeout).actionLabel).toBe('Retry');
    expect(readerStatusCopy(FAILURES.malformed).actionLabel).toBe('Retry');
    expect(readerStatusCopy(FAILURES.serverFault).actionLabel).toBe('Retry');

    const wrong = readerStatusCopy(FAILURES.wrongAddress);
    expect(wrong.actionLabel).not.toBe('Retry');
    expect(wrong.actionLabel).not.toBeNull();
  });
});

describe('the empty chapter', () => {
  it('is not an error, and says what to do about it', () => {
    expect(EMPTY_CHAPTER_COPY.tone).toBe('empty');
    expect(EMPTY_CHAPTER_COPY.actionLabel).toBe('Change translation');
  });
});

describe('badAddressCopy', () => {
  it('uses the reason it was given verbatim', () => {
    const reason = 'Proverbs has 31 chapters, so there is no chapter 45.';
    expect(badAddressCopy(reason).body).toBe(reason);
    expect(badAddressCopy(reason).tone).toBe('notFound');
  });
});
