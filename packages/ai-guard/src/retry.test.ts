/**
 * Tests for the retry policy.
 *
 * Purpose
 *   Prove the backoff really is exponential, really is jittered, and — the part that matters
 *   for money — that a guard refusal is never classified as retryable.
 */

import { describe, expect, it } from 'vitest';
import {
  BudgetExhaustedError,
  ProviderRequestError,
  RateLimitExceededError,
  RequestTimeoutError,
  TaskNotRoutableError,
} from './errors';
import { DEFAULT_RETRY_POLICY, computeBackoffDelayMs, isRetryableFailure } from './retry';

describe('isRetryableFailure', () => {
  it('never retries a budget refusal, because it is a decision and not a fault', () => {
    const refusal = new BudgetExhaustedError({
      ceilingUsd: 0.1,
      exposureUsd: 0.1,
      requestedUsd: 0.001,
    });
    expect(isRetryableFailure(refusal)).toBe(false);
  });

  it('never retries a rate-cap refusal', () => {
    const refusal = new RateLimitExceededError({
      limitKind: 'process_total',
      limit: 500,
      observed: 500,
    });
    expect(isRetryableFailure(refusal)).toBe(false);
  });

  it('never retries an unroutable task', () => {
    expect(isRetryableFailure(new TaskNotRoutableError('embed is self-hosted'))).toBe(false);
  });

  it('retries an upstream overload', () => {
    expect(isRetryableFailure(new ProviderRequestError('engine_overloaded', 429))).toBe(true);
  });

  it('retries a gateway failure', () => {
    expect(isRetryableFailure(new ProviderRequestError('bad gateway', 502))).toBe(true);
  });

  it('retries a transport failure that never reached an HTTP response', () => {
    expect(isRetryableFailure(new ProviderRequestError('socket reset', null))).toBe(true);
  });

  it('retries a timeout', () => {
    expect(isRetryableFailure(new RequestTimeoutError(30_000))).toBe(true);
  });

  it('does not retry a malformed request', () => {
    expect(isRetryableFailure(new ProviderRequestError('bad schema', 400))).toBe(false);
  });

  it('does not retry an authentication failure, which will fail identically forever', () => {
    expect(isRetryableFailure(new ProviderRequestError('unauthorised', 401))).toBe(false);
  });
});

describe('computeBackoffDelayMs', () => {
  it('doubles the delay with each completed attempt', () => {
    const deterministic = () => 1;
    const first = computeBackoffDelayMs(1, DEFAULT_RETRY_POLICY, deterministic);
    const second = computeBackoffDelayMs(2, DEFAULT_RETRY_POLICY, deterministic);
    const third = computeBackoffDelayMs(3, DEFAULT_RETRY_POLICY, deterministic);

    expect(second).toBeCloseTo(first * 2, 6);
    expect(third).toBeCloseTo(second * 2, 6);
  });

  it('jitters within the equal-jitter band rather than firing on a fixed instant', () => {
    const policy = { maxAttempts: 5, baseDelayMs: 1_000, maxDelayMs: 60_000 };
    const floor = computeBackoffDelayMs(1, policy, () => 0);
    const ceiling = computeBackoffDelayMs(1, policy, () => 0.999999);

    expect(floor).toBe(500);
    expect(ceiling).toBeLessThanOrEqual(1_000);
    expect(ceiling).toBeGreaterThan(999);
  });

  it('never exceeds the configured maximum delay', () => {
    const policy = { maxAttempts: 12, baseDelayMs: 1_000, maxDelayMs: 4_000 };
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      expect(computeBackoffDelayMs(attempt, policy, () => 1)).toBeLessThanOrEqual(4_000);
    }
  });

  it('never returns a negative delay', () => {
    expect(computeBackoffDelayMs(0, DEFAULT_RETRY_POLICY, () => 0)).toBeGreaterThanOrEqual(0);
  });
});
