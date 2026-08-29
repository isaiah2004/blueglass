/**
 * When to try again, and how long to wait first. Pure arithmetic, no timers.
 *
 * Purpose
 *   Rule 6.4.2 asks for exponential backoff **with jitter** and a bounded attempt
 *   count. Keeping the arithmetic in its own module — separate from the loop in
 *   `retry.ts` that acts on it — is what makes "the third wait is longer than the
 *   second, and no two clients wake up together" testable without a clock.
 *
 * Why jitter is not optional here
 *   Every reader who opens the app at 6am hits the same four endpoints. A pure
 *   exponential schedule makes them all retry at *exactly* 300ms, then 600ms, then
 *   1200ms — the thundering herd that turns a brief server hiccup into a sustained one.
 *   Randomising half of each delay spreads the same retries over a window.
 *
 * Which half is randomised, and why not all of it
 *   This is "equal jitter": half the computed delay is fixed, half is random. Full
 *   jitter (`random() * delay`) spreads better but can produce a near-zero wait, which
 *   for a server returning `503` means hammering it immediately. Equal jitter keeps a
 *   guaranteed floor while still decorrelating clients.
 *
 * Dependencies
 *   `api-error.ts` only. No timers, no platform, no I/O.
 */

import type { ApiError } from './api-error';

/** How hard to try. */
export interface RetryPolicy {
  /** Total attempts including the first. `1` disables retrying. */
  readonly maxAttempts: number;
  /** The wait before the second attempt, before jitter. */
  readonly baseDelayMs: number;
  /** Ceiling for the computed delay, applied before jitter. */
  readonly maxDelayMs: number;
  /** Fraction of each delay that is randomised, `0`–`1`. `0.5` is equal jitter. */
  readonly jitterRatio: number;
}

/**
 * The policy every request uses unless told otherwise.
 *
 * Three attempts, not five: the reader is watching. With these numbers the worst case
 * before a failure is shown is roughly `timeout + 0.3s + timeout + 0.6s + timeout`,
 * which at the default 10s budget is a little over half a minute — already at the edge
 * of what someone will wait, and beyond it for a search box.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 4_000,
  jitterRatio: 0.5,
};

/** A policy that never retries. For anything non-idempotent (rule 6.4.2). */
export const NO_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
  jitterRatio: 0,
};

/** Source of randomness for the jitter. Tests inject a deterministic one. */
export type RandomSource = () => number;

/**
 * How long to wait before a given attempt.
 *
 * @param attemptsMade - Attempts already completed. `1` computes the wait before the
 *                       second attempt.
 * @param policy - The schedule to follow.
 * @param random - Returns `[0, 1)`. Defaults to `Math.random`.
 * @returns Whole milliseconds, never negative and never above `maxDelayMs`.
 *          Side effects: none beyond consuming one random number.
 *
 * @example
 * // base 300, ratio 0.5: attempt 2 waits 150–300ms, attempt 3 waits 300–600ms.
 * backoffDelayMs(1, DEFAULT_RETRY_POLICY, () => 0);   // 150
 * backoffDelayMs(2, DEFAULT_RETRY_POLICY, () => 0.99) // ~597
 */
export function backoffDelayMs(
  attemptsMade: number,
  policy: RetryPolicy,
  random: RandomSource = Math.random,
): number {
  if (attemptsMade < 1) return 0;

  const exponential = policy.baseDelayMs * 2 ** (attemptsMade - 1);
  const capped = Math.min(exponential, policy.maxDelayMs);
  const ratio = Math.min(Math.max(policy.jitterRatio, 0), 1);
  const fixed = capped * (1 - ratio);

  return Math.round(fixed + random() * capped * ratio);
}

/**
 * Should the runner make another attempt?
 *
 * Two independent conditions, both required: the failure has to be the kind another
 * attempt could fix (`isRetryable`, decided once in `api-error.ts`), and the budget has
 * to be left. A cancelled request fails the first; a fourth attempt fails the second.
 *
 * @param error - The failure the last attempt produced.
 * @param attemptsMade - Attempts already completed.
 * @param policy - The schedule to follow.
 * @returns Whether to try again. Side effects: none.
 */
export function shouldRetry(error: ApiError, attemptsMade: number, policy: RetryPolicy): boolean {
  return error.isRetryable && attemptsMade < policy.maxAttempts;
}
