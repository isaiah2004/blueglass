/**
 * Retry policy — exponential backoff with jitter, and the rules about what may be retried.
 *
 * Purpose
 *   Rule 6.4.2 requires retries with exponential backoff *and* jitter and a capped attempt
 *   count. This module holds that logic as pure functions so the timing can be tested
 *   deterministically, without sleeping and without a network.
 *
 * Key responsibilities
 *   - Decide whether a given failure is worth retrying.
 *   - Compute the delay before the next attempt.
 *
 * What is never retried, and why it matters for the budget
 *   `BudgetExhaustedError` and `RateLimitExceededError` are guard decisions, not transient
 *   faults. Retrying them would turn one refusal into `maxAttempts` refusals and, worse,
 *   would make the guard look flaky rather than final. `isRetryableFailure` returns false
 *   for every `AiGuardError` except a provider transport failure, so the only thing that can
 *   ever be retried is a call that genuinely reached the provider and genuinely failed.
 *
 * Why equal jitter
 *   Full backoff with no jitter synchronises every client in a fleet onto the same retry
 *   instant, which is how a rate-limited provider stays rate-limited. Equal jitter keeps
 *   half the delay deterministic (so backoff still grows) and randomises the other half.
 *
 * Dependencies
 *   Pure. No clock, no timers — the caller supplies both the random source and the sleep.
 */

import { ProviderRequestError, RequestTimeoutError } from './errors';

/** Tunables for the backoff curve. */
export interface RetryPolicy {
  /** Total attempts including the first. `1` disables retrying. */
  readonly maxAttempts: number;
  /** Delay before the second attempt, in milliseconds. */
  readonly baseDelayMs: number;
  /** Upper bound on any single delay. */
  readonly maxDelayMs: number;
}

/** Sensible defaults for a provider that returns occasional 429s under load. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 8_000,
};

/** HTTP statuses worth trying again. Everything else is a bug in the request. */
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/**
 * Whether a failure should be retried.
 *
 * @param failure Anything thrown by the provider adapter.
 * @returns True only for a transient transport or upstream failure.
 *
 * @example
 * ```ts
 * isRetryableFailure(new ProviderRequestError('overloaded', 429)); // true
 * isRetryableFailure(new BudgetExhaustedError({ ... }));           // false — never
 * ```
 */
export function isRetryableFailure(failure: unknown): boolean {
  if (failure instanceof RequestTimeoutError) {
    return true;
  }
  if (failure instanceof ProviderRequestError) {
    // A null status means the request never got an HTTP response at all — DNS, socket
    // reset, TLS. Those are the most retryable failures there are.
    return failure.status === null || RETRYABLE_STATUSES.has(failure.status);
  }
  return false;
}

/**
 * Delay before the next attempt, with equal jitter.
 *
 * The deterministic half is `base * 2^(attempt - 1)`, capped at `maxDelayMs`. Half of that
 * is fixed and half is multiplied by a random factor, giving a delay uniformly distributed
 * in `[exponential / 2, exponential]`.
 *
 * @param completedAttempts How many attempts have already failed. Must be at least 1.
 * @param policy            Backoff tunables.
 * @param randomSource      Returns a value in `[0, 1)`. Injected so tests are deterministic.
 * @returns Milliseconds to wait, never negative and never above `maxDelayMs`.
 *
 * @example
 * ```ts
 * computeBackoffDelayMs(1, DEFAULT_RETRY_POLICY, () => 0);   // 125 — the floor
 * computeBackoffDelayMs(1, DEFAULT_RETRY_POLICY, () => 0.999); // just under 250
 * ```
 */
export function computeBackoffDelayMs(
  completedAttempts: number,
  policy: RetryPolicy,
  randomSource: () => number = Math.random,
): number {
  const exponent = Math.max(0, completedAttempts - 1);
  const exponential = Math.min(policy.baseDelayMs * 2 ** exponent, policy.maxDelayMs);
  const fixedHalf = exponential / 2;
  const jitteredHalf = fixedHalf * randomSource();
  return Math.min(policy.maxDelayMs, Math.max(0, fixedHalf + jitteredHalf));
}

/**
 * Wait for a number of milliseconds.
 *
 * Extracted so `AiClient` can be handed an instant no-op sleeper in tests, which is what
 * lets the retry tests run in microseconds instead of seconds.
 *
 * @param durationMs How long to wait.
 * @returns A promise that settles after the delay.
 */
export function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
