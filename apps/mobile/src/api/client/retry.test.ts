/**
 * Tests for the retry loop.
 *
 * What these prove
 *   - **Attempts do not double-fire.** The operation is called exactly as many times as
 *     the policy allows, one at a time, and never concurrently. A loop that raced the
 *     original request against its replacement would send requests nobody asked for.
 *   - The waits between attempts are the backoff schedule, in order.
 *   - A cancellation stops the loop and the pending wait.
 *   - The failure that comes back carries the number of attempts actually made.
 */

import { describe, expect, it, vi } from 'vitest';

import { networkError, timeoutError, type ApiError } from './api-error';
import { apiFailure, apiSuccess, type ApiResult } from './api-result';
import { runWithRetry, type Sleep } from './retry';
import { DEFAULT_RETRY_POLICY, NO_RETRY_POLICY } from './retry-policy';

/** A sleep that records what it was asked to wait and returns immediately. */
function createRecordingSleep(): { sleep: Sleep; waits: number[] } {
  const waits: number[] = [];
  const sleep: Sleep = (ms) => {
    waits.push(ms);
    return Promise.resolve();
  };
  return { sleep, waits };
}

/** Jitter fixed at its floor, so the recorded waits are exactly the schedule. */
const noJitter = (): number => 0;

describe('runWithRetry', () => {
  it('returns the first success without retrying', async () => {
    const attempt = vi.fn(() => Promise.resolve(apiSuccess('Genesis 1')));

    const result = await runWithRetry(attempt, { policy: DEFAULT_RETRY_POLICY });

    expect(result).toEqual(apiSuccess('Genesis 1'));
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('calls the operation exactly maxAttempts times and no more', async () => {
    const { sleep } = createRecordingSleep();
    const attempt = vi.fn(() => Promise.resolve(apiFailure(networkError(new Error('down')))));

    await runWithRetry(attempt, {
      policy: DEFAULT_RETRY_POLICY,
      sleep,
      random: noJitter,
    });

    expect(attempt).toHaveBeenCalledTimes(DEFAULT_RETRY_POLICY.maxAttempts);
  });

  it('never has two attempts in flight at once', async () => {
    const { sleep } = createRecordingSleep();
    let inFlight = 0;
    let maxInFlight = 0;

    const attempt = (): Promise<ApiResult<never>> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return Promise.resolve().then(() => {
        inFlight -= 1;
        return apiFailure(timeoutError(10));
      });
    };

    await runWithRetry(attempt, { policy: DEFAULT_RETRY_POLICY, sleep, random: noJitter });

    expect(maxInFlight).toBe(1);
  });

  it('waits the backoff schedule, growing, between attempts', async () => {
    const { sleep, waits } = createRecordingSleep();
    const attempt = () => Promise.resolve(apiFailure(timeoutError(10)));

    await runWithRetry(attempt, { policy: DEFAULT_RETRY_POLICY, sleep, random: noJitter });

    // Three attempts means two waits: before the second, and before the third.
    expect(waits).toEqual([150, 300]);
    expect(waits[1]).toBeGreaterThan(waits[0] ?? 0);
  });

  it('stops as soon as an attempt succeeds', async () => {
    const { sleep, waits } = createRecordingSleep();
    const attempt = vi
      .fn<() => Promise<ApiResult<string>>>()
      .mockResolvedValueOnce(apiFailure(networkError(new Error('flap'))))
      .mockResolvedValueOnce(apiSuccess('John 3'));

    const result = await runWithRetry(attempt, {
      policy: DEFAULT_RETRY_POLICY,
      sleep,
      random: noJitter,
    });

    expect(result).toEqual(apiSuccess('John 3'));
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(waits).toHaveLength(1);
  });

  it('does not retry a failure the policy calls terminal', async () => {
    const attempt = vi.fn(() => Promise.resolve(apiFailure(networkError(new Error('down')))));

    await runWithRetry(attempt, { policy: NO_RETRY_POLICY });

    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('reports how many attempts were made', async () => {
    const { sleep } = createRecordingSleep();
    const attempt = () => Promise.resolve(apiFailure(timeoutError(10)));

    const result = await runWithRetry(attempt, {
      policy: DEFAULT_RETRY_POLICY,
      sleep,
      random: noJitter,
    });

    expect(result.ok).toBe(false);
    const error = (result as { error: ApiError }).error;
    expect(error.attempts).toBe(DEFAULT_RETRY_POLICY.maxAttempts);
    expect(error.kind).toBe('timeout');
  });

  it('abandons the loop when the caller aborts before the first attempt', async () => {
    const controller = new AbortController();
    controller.abort();
    const attempt = vi.fn(() => Promise.resolve(apiSuccess('never')));

    const result = await runWithRetry(attempt, {
      policy: DEFAULT_RETRY_POLICY,
      signal: controller.signal,
    });

    expect(attempt).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect((result as { error: ApiError }).error.kind).toBe('aborted');
  });

  it('abandons the loop when the caller aborts during a backoff wait', async () => {
    const controller = new AbortController();
    const sleep: Sleep = () => {
      controller.abort();
      return Promise.resolve();
    };
    const attempt = vi.fn(() => Promise.resolve(apiFailure(timeoutError(10))));

    const result = await runWithRetry(attempt, {
      policy: DEFAULT_RETRY_POLICY,
      sleep,
      random: noJitter,
      signal: controller.signal,
    });

    expect(attempt).toHaveBeenCalledTimes(1);
    expect((result as { error: ApiError }).error.kind).toBe('aborted');
  });
});
