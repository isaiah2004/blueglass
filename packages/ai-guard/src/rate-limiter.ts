/**
 * The per-process call rate cap — the guard's second line of defence.
 *
 * Purpose
 *   Stop a runaway loop by *call count* long before it can be stopped by dollars. The money
 *   ceiling in `ledger.ts` is the guarantee; this is the tripwire that fires first, in
 *   seconds rather than in however long it takes to burn a budget.
 *
 * Key responsibilities
 *   - Cap the total number of provider calls one process may ever make.
 *   - Cap how many it may make inside a sliding time window.
 *
 * Why per process rather than shared
 *   Money is the cross-process limit and lives on disk. Call rate is about protecting a
 *   single misbehaving loop from itself, and keeping it in memory means the check costs
 *   nothing and cannot be affected by a wedged lock file. A hundred processes get a hundred
 *   call quotas but still share one ceiling.
 *
 * Only granted calls count
 *   `recordGrantedCall` is deliberately separate from `assertWithinCaps`, so a call the
 *   budget refused consumes no rate quota. Otherwise a budget rejection would masquerade as
 *   a rate-limit rejection and hide which ceiling actually bit.
 *
 * Dependencies
 *   None beyond an injectable clock, so the sliding window is testable without waiting.
 */

import { RateLimitExceededError } from './errors';

/** Construction options. */
export interface CallRateLimiterOptions {
  /** Lifetime cap on provider calls from this process. */
  readonly maxCallsPerProcess: number;
  /** Cap on provider calls inside one `rateWindowMs` window. */
  readonly maxCallsPerWindow: number;
  readonly rateWindowMs: number;
  /** Injectable clock. Defaults to `Date.now`. */
  readonly now?: () => number;
}

/**
 * In-memory call rate cap for one process.
 *
 * Owns: the call counters and the sliding window. Does not own: money, persistence, or any
 * knowledge of what a "call" costs.
 */
export class CallRateLimiter {
  readonly #maxCallsPerProcess: number;
  readonly #maxCallsPerWindow: number;
  readonly #rateWindowMs: number;
  readonly #now: () => number;

  /** Timestamps of calls granted by this process, oldest first. */
  readonly #recentCallTimestamps: number[] = [];
  #processCallCount = 0;

  constructor(options: CallRateLimiterOptions) {
    this.#maxCallsPerProcess = options.maxCallsPerProcess;
    this.#maxCallsPerWindow = options.maxCallsPerWindow;
    this.#rateWindowMs = options.rateWindowMs;
    this.#now = options.now ?? Date.now;
  }

  /**
   * Check both caps before a call is granted.
   *
   * @throws {RateLimitExceededError} When the lifetime or the sliding-window cap is reached.
   */
  assertWithinCaps(): void {
    if (this.#processCallCount >= this.#maxCallsPerProcess) {
      throw new RateLimitExceededError({
        limitKind: 'process_total',
        limit: this.#maxCallsPerProcess,
        observed: this.#processCallCount,
      });
    }
    this.#dropTimestampsOutsideWindow();
    if (this.#recentCallTimestamps.length >= this.#maxCallsPerWindow) {
      throw new RateLimitExceededError({
        limitKind: 'sliding_window',
        limit: this.#maxCallsPerWindow,
        observed: this.#recentCallTimestamps.length,
      });
    }
  }

  /** Record that a call was granted. Only granted calls consume quota. */
  recordGrantedCall(): void {
    this.#processCallCount += 1;
    this.#recentCallTimestamps.push(this.#now());
  }

  /** Discard call timestamps that have aged out of the sliding window. */
  #dropTimestampsOutsideWindow(): void {
    const windowStart = this.#now() - this.#rateWindowMs;
    while (this.#recentCallTimestamps.length > 0) {
      const oldest = this.#recentCallTimestamps[0];
      if (oldest === undefined || oldest >= windowStart) {
        return;
      }
      this.#recentCallTimestamps.shift();
    }
  }
}
