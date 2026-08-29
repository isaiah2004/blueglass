/**
 * The retry loop: run an attempt, and decide whether to run another.
 *
 * Purpose
 *   The half of rule 6.4.2 that `retry-policy.ts` cannot be: something has to actually
 *   wait, and something has to count. Splitting them means the schedule is tested with
 *   arithmetic and the loop is tested with a counter, and neither test needs a real
 *   clock.
 *
 * The invariant this module exists to hold
 *   **One attempt is in flight at a time, and the total number of attempts is exactly
 *   the number of times `attempt` is called.** A retry implementation that races the
 *   original request against its replacement — or that keeps a timer alive after the
 *   caller aborts — sends a second request the caller never asked for. For a `GET` that
 *   is wasted bandwidth; for anything metered it is a double charge. `runWithRetry`
 *   awaits each attempt fully, sleeps only between attempts, and abandons both the
 *   sleep and the loop the moment the signal aborts.
 *
 * Idempotence
 *   Only safe for idempotent operations. Every endpoint this client currently exposes
 *   is a `GET`. Anything that writes must pass {@link NO_RETRY_POLICY} or carry an
 *   idempotency key (rule 6.4.5).
 *
 * Dependencies
 *   `api-error.ts`, `api-result.ts`, `retry-policy.ts`. No platform: the delay is
 *   performed by an injected {@link Sleep}.
 */

import { abortedError, withAttempts } from './api-error';
import { apiFailure, type ApiResult } from './api-result';
import { backoffDelayMs, shouldRetry, type RandomSource, type RetryPolicy } from './retry-policy';

/**
 * Wait, or resolve early if the signal aborts.
 *
 * Injected rather than imported so tests can run the whole loop synchronously; the
 * default is the platform's `setTimeout`.
 */
export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

/** One try. Receives the 1-based attempt number, purely so it can be logged. */
export type Attempt<TValue> = (attemptNumber: number) => Promise<ApiResult<TValue>>;

/** Everything the loop needs besides the attempt itself. */
export interface RetryRunnerOptions {
  readonly policy: RetryPolicy;
  /**
   * Waits between attempts. Defaults to {@link defaultSleep}.
   *
   * Typed `| undefined` rather than left merely optional because the workspace sets
   * `exactOptionalPropertyTypes`: a caller forwarding its own optional field would
   * otherwise be a type error at every call site. The same applies to the two below.
   */
  readonly sleep?: Sleep | undefined;
  /** Jitter source. Defaults to `Math.random`. */
  readonly random?: RandomSource | undefined;
  /** Cancels the loop, including a pending backoff wait. */
  readonly signal?: AbortSignal | undefined;
}

/**
 * The platform sleep, cancellable by an abort signal.
 *
 * Removes its own listener on every exit path, so a long-lived signal — one shared by a
 * whole screen — does not accumulate a listener per request (rule 6.6.1).
 *
 * @param ms - How long to wait.
 * @param signal - Optional cancellation. Resolves immediately when already aborted.
 * @returns A promise that always resolves, never rejects. Side effects: one timer.
 */
export const defaultSleep: Sleep = (ms, signal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted === true) {
      resolve();
      return;
    }

    const finish = (): void => {
      globalThis.clearTimeout(handle);
      signal?.removeEventListener('abort', finish);
      resolve();
    };

    const handle = globalThis.setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
  });

/**
 * Run an attempt, retrying on retryable failures with backoff and jitter.
 *
 * @param attempt - The operation. Called once per attempt, never concurrently.
 * @param options - Policy, clock, randomness, cancellation.
 * @returns The first success, or the last failure restated with the attempt count.
 *          Side effects: calls `attempt`, and sleeps between calls.
 */
export async function runWithRetry<TValue>(
  attempt: Attempt<TValue>,
  options: RetryRunnerOptions,
): Promise<ApiResult<TValue>> {
  const { policy, sleep = defaultSleep, random, signal } = options;
  let attemptsMade = 0;

  for (;;) {
    if (signal?.aborted === true) {
      return apiFailure(abortedError(Math.max(attemptsMade, 1)));
    }

    attemptsMade += 1;
    const result = await attempt(attemptsMade);
    if (result.ok) return result;

    if (!shouldRetry(result.error, attemptsMade, policy)) {
      return apiFailure(withAttempts(result.error, attemptsMade));
    }

    await sleep(backoffDelayMs(attemptsMade, policy, random), signal);
  }
}
