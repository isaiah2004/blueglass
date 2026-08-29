/**
 * Tests for the backoff arithmetic and the retry decision.
 *
 * What these prove
 *   - Delays grow exponentially and are capped.
 *   - Jitter is real: two clients with different random draws wait different lengths,
 *     and neither ever waits zero. That is the whole point of rule 6.4.2's "with
 *     jitter" — a schedule without it synchronises every client onto one instant.
 *   - A non-retryable failure is never retried, however much budget is left.
 */

import { describe, expect, it } from 'vitest';

import { abortedError, httpError, networkError, timeoutError } from './api-error';
import { backoffDelayMs, DEFAULT_RETRY_POLICY, NO_RETRY_POLICY, shouldRetry } from './retry-policy';

describe('backoffDelayMs', () => {
  it('grows exponentially when the jitter draw is at its floor', () => {
    const noJitter = { ...DEFAULT_RETRY_POLICY, jitterRatio: 0 };

    expect(backoffDelayMs(1, noJitter, () => 0)).toBe(300);
    expect(backoffDelayMs(2, noJitter, () => 0)).toBe(600);
    expect(backoffDelayMs(3, noJitter, () => 0)).toBe(1_200);
  });

  it('caps the delay at maxDelayMs', () => {
    const noJitter = { ...DEFAULT_RETRY_POLICY, jitterRatio: 0 };

    // 300 * 2^9 is 153,600 — the cap must win.
    expect(backoffDelayMs(10, noJitter, () => 0)).toBe(DEFAULT_RETRY_POLICY.maxDelayMs);
  });

  it('never returns zero, so a 503 is never hammered immediately', () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(backoffDelayMs(attempt, DEFAULT_RETRY_POLICY, () => 0)).toBeGreaterThan(0);
    }
  });

  it('keeps equal jitter inside half the computed delay', () => {
    // Attempt 2 computes 600ms. With ratio 0.5 the wait is 300ms plus 0–300ms.
    expect(backoffDelayMs(2, DEFAULT_RETRY_POLICY, () => 0)).toBe(300);
    expect(backoffDelayMs(2, DEFAULT_RETRY_POLICY, () => 0.5)).toBe(450);
    expect(backoffDelayMs(2, DEFAULT_RETRY_POLICY, () => 0.999)).toBeLessThanOrEqual(600);
  });

  it('separates two clients that retry at the same moment', () => {
    const first = backoffDelayMs(2, DEFAULT_RETRY_POLICY, () => 0.1);
    const second = backoffDelayMs(2, DEFAULT_RETRY_POLICY, () => 0.9);

    expect(first).not.toBe(second);
  });

  it('returns zero before the first attempt, which needs no wait', () => {
    expect(backoffDelayMs(0, DEFAULT_RETRY_POLICY, () => 0.5)).toBe(0);
  });

  it('clamps a jitter ratio outside 0–1 instead of producing a negative wait', () => {
    const absurd = { ...DEFAULT_RETRY_POLICY, jitterRatio: 4 };

    expect(backoffDelayMs(1, absurd, () => 0)).toBe(0);
    expect(backoffDelayMs(1, absurd, () => 1)).toBe(300);
  });
});

describe('shouldRetry', () => {
  it('retries a timeout while attempts remain', () => {
    expect(shouldRetry(timeoutError(1_000), 1, DEFAULT_RETRY_POLICY)).toBe(true);
    expect(shouldRetry(networkError(new Error('offline')), 2, DEFAULT_RETRY_POLICY)).toBe(true);
  });

  it('stops at maxAttempts', () => {
    expect(shouldRetry(timeoutError(1_000), 3, DEFAULT_RETRY_POLICY)).toBe(false);
  });

  it('never retries a cancellation', () => {
    expect(shouldRetry(abortedError(), 1, DEFAULT_RETRY_POLICY)).toBe(false);
  });

  it('never retries a client error, but does retry a server one', () => {
    const notFound = httpError({ status: 404, code: 'chapter_not_found', message: 'gone' });
    const serverFault = httpError({ status: 503, code: 'dependency_unavailable', message: 'db' });

    expect(shouldRetry(notFound, 1, DEFAULT_RETRY_POLICY)).toBe(false);
    expect(shouldRetry(serverFault, 1, DEFAULT_RETRY_POLICY)).toBe(true);
  });

  it('retries 408 and 429 as well as 5xx', () => {
    const timedOut = httpError({ status: 408, code: 'http_error', message: 'slow' });
    const throttled = httpError({ status: 429, code: 'rate_limited', message: 'wait' });

    expect(shouldRetry(timedOut, 1, DEFAULT_RETRY_POLICY)).toBe(true);
    expect(shouldRetry(throttled, 1, DEFAULT_RETRY_POLICY)).toBe(true);
  });

  it('never retries under NO_RETRY_POLICY', () => {
    expect(shouldRetry(timeoutError(1_000), 1, NO_RETRY_POLICY)).toBe(false);
  });
});
