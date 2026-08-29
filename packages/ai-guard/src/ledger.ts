/**
 * The spend ledger — a durable, cross-process, fail-closed ceiling on AI spend.
 *
 * Purpose
 *   Make it structurally impossible for any loop, however tight and however many processes
 *   it fans out across, to spend more than the configured ceiling.
 *
 * Key responsibilities
 *   - `reserve` a pessimistic worst-case cost *before* a provider call, refusing when the
 *     ceiling would be crossed.
 *   - `commit` the provider's real reported cost afterwards.
 *   - `release` a reservation that provably cost nothing.
 *   - Delegate the per-process call cap to `CallRateLimiter`, an independent second line of
 *     defence that fires long before the money runs out.
 *
 * The four properties that make a runaway loop harmless
 *   1. Reserve first, settle later. The worst case is debited before the request goes out,
 *      so a process killed mid-flight leaves the ledger pessimistic, never optimistic.
 *   2. Durable. The total lives in a file, so restarting the process — or starting a
 *      hundred of them — does not reset it.
 *   3. Serialised. Every read-modify-write happens inside a synchronous critical section
 *      under a cross-process file lock, so two callers cannot both read "there is room".
 *   4. No escape hatch. There is no `force`, no `skipLedger`, and no environment variable
 *      that disables the check. `BudgetExhaustedError` is never caught inside this package.
 *
 * Thread safety
 *   Safe across processes via the file lock, and safe across concurrent async callers in one
 *   process because the critical sections contain no `await`.
 *
 * Usage
 *   ```ts
 *   const ledger = createSpendLedger(loadConfig());
 *   const reservation = ledger.reserve('classify_cheap', 0.0002); // throws if over ceiling
 *   ledger.commit(reservation, reportedCostUsd);
 *   ```
 */

import { randomUUID } from 'node:crypto';
import { assertSpendCeilingIsPermitted, type AiGuardConfig } from './config';
import { BudgetExhaustedError, InvalidReservationError } from './errors';
import { withFileLockSync } from './file-lock';
import {
  createEmptyLedgerState,
  readLedgerStateSync,
  sumOpenReservations,
  writeLedgerStateSync,
  type LedgerState,
  type ReservationRecord,
} from './ledger-store';
import { NULL_LOGGER, type StructuredLogger } from './logger';
import { CallRateLimiter } from './rate-limiter';
import type { AiTask } from './types';

/** A claim on part of the budget, held until the matching call settles. */
export interface Reservation {
  readonly id: string;
  readonly reservedUsd: number;
  readonly task: AiTask;
}

/** A point-in-time view of the ledger, for diagnostics and tests. */
export interface LedgerSnapshot {
  readonly committedUsd: number;
  /** Committed plus everything currently reserved. This is the figure the ceiling limits. */
  readonly exposureUsd: number;
  readonly remainingUsd: number;
  readonly openReservationCount: number;
  readonly callCount: number;
}

/** Construction options. */
export interface SpendLedgerOptions {
  readonly ledgerPath: string;
  readonly ceilingUsd: number;
  readonly maxCallsPerProcess: number;
  readonly maxCallsPerWindow: number;
  readonly rateWindowMs: number;
  readonly logger?: StructuredLogger;
  /** Injectable clock, so rate-cap behaviour is testable without waiting. */
  readonly now?: () => number;
}

/**
 * Durable spend ceiling with a per-process rate cap.
 *
 * Owns: the money ceiling and the reservation lifecycle.
 * Does not own: pricing (`pricing.ts`), the call-rate cap (`rate-limiter.ts`), retries, or
 * caching. It is deliberately unaware that a "call" is an HTTP request at all.
 */
export class SpendLedger {
  readonly #ledgerPath: string;
  readonly #ceilingUsd: number;
  readonly #rateLimiter: CallRateLimiter;
  readonly #logger: StructuredLogger;
  readonly #now: () => number;

  constructor(options: SpendLedgerOptions) {
    assertSpendCeilingIsPermitted(options.ceilingUsd);
    this.#ledgerPath = options.ledgerPath;
    this.#ceilingUsd = options.ceilingUsd;
    this.#logger = options.logger ?? NULL_LOGGER;
    this.#now = options.now ?? Date.now;
    this.#rateLimiter = new CallRateLimiter({
      maxCallsPerProcess: options.maxCallsPerProcess,
      maxCallsPerWindow: options.maxCallsPerWindow,
      rateWindowMs: options.rateWindowMs,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
  }

  /**
   * Claim budget for one provider call.
   *
   * @param task         Logical task, recorded for diagnosis of a wedged ledger.
   * @param worstCaseUsd Pessimistic cost from `estimateWorstCaseCostUsd`.
   * @returns A reservation that must later be passed to `commit` or `release`.
   * @throws {RateLimitExceededError} If this process has already made too many calls.
   * @throws {BudgetExhaustedError} If granting it would cross the ceiling. Nothing is
   *   written to disk and the provider is not called.
   * @throws {LedgerUnavailableError} If the ledger cannot be read, locked, or written.
   */
  reserve(task: AiTask, worstCaseUsd: number): Reservation {
    const requestedUsd = Number.isFinite(worstCaseUsd) ? Math.max(0, worstCaseUsd) : Infinity;
    this.#rateLimiter.assertWithinCaps();

    const reservation: Reservation = { id: randomUUID(), reservedUsd: requestedUsd, task };

    this.#mutate((state) => {
      const exposureUsd = state.committedUsd + sumOpenReservations(state);
      if (exposureUsd + requestedUsd > this.#ceilingUsd) {
        throw new BudgetExhaustedError({ ceilingUsd: this.#ceilingUsd, exposureUsd, requestedUsd });
      }
      const record: ReservationRecord = {
        reservedUsd: requestedUsd,
        task,
        createdAtMs: this.#now(),
      };
      return {
        ...state,
        callCount: state.callCount + 1,
        openReservations: { ...state.openReservations, [reservation.id]: record },
      };
    });

    // Only granted reservations consume rate quota. Counting refusals would let a budget
    // rejection masquerade as a rate-limit rejection, hiding which ceiling actually bit.
    this.#rateLimiter.recordGrantedCall();
    return reservation;
  }

  /**
   * Settle a reservation against the provider's reported cost.
   *
   * @param reservation Reservation returned by `reserve`.
   * @param actualUsd Real cost, from `resolveActualCostUsd`. Negative values clamp to zero;
   *   a non-finite value falls back to the full reservation rather than releasing it.
   * @throws {InvalidReservationError} If the reservation was already settled. This is what
   *   stops a retry path from charging one provider call to the ledger twice.
   */
  commit(reservation: Reservation, actualUsd: number): void {
    const settledUsd = Number.isFinite(actualUsd)
      ? Math.max(0, actualUsd)
      : reservation.reservedUsd;
    if (settledUsd > reservation.reservedUsd) {
      this.#logger.warn('AI call cost more than was reserved for it', {
        task: reservation.task,
        reserved_usd: reservation.reservedUsd,
        actual_usd: settledUsd,
      });
    }
    this.#settle(reservation, settledUsd);
  }

  /**
   * Discard a reservation for a call that was provably never billed.
   *
   * @param reservation Reservation returned by `reserve`.
   * @throws {InvalidReservationError} If it was already settled.
   */
  release(reservation: Reservation): void {
    this.#settle(reservation, 0);
  }

  /** Read the ledger without modifying it. */
  snapshot(): LedgerSnapshot {
    const state = withFileLockSync(this.#ledgerPath, () => readLedgerStateSync(this.#ledgerPath));
    const exposureUsd = state.committedUsd + sumOpenReservations(state);
    return {
      committedUsd: state.committedUsd,
      exposureUsd,
      remainingUsd: Math.max(0, this.#ceilingUsd - exposureUsd),
      openReservationCount: Object.keys(state.openReservations).length,
      callCount: state.callCount,
    };
  }

  /** Remove a reservation and add its settled cost to the committed total. */
  #settle(reservation: Reservation, settledUsd: number): void {
    this.#mutate((state) => {
      if (!(reservation.id in state.openReservations)) {
        throw new InvalidReservationError(
          reservation.id,
          `Reservation ${reservation.id} is not open. It was already settled, which means ` +
            'something tried to charge one provider call to the ledger twice.',
        );
      }
      const remaining: Record<string, ReservationRecord> = { ...state.openReservations };
      delete remaining[reservation.id];
      return {
        ...state,
        committedUsd: state.committedUsd + settledUsd,
        openReservations: remaining,
      };
    });
  }

  /**
   * Read-modify-write the ledger inside one synchronous, cross-process critical section.
   *
   * `transform` may throw to abandon the update, in which case nothing is written. That is
   * how a refused reservation leaves no trace on disk.
   */
  #mutate(transform: (state: LedgerState) => LedgerState): void {
    withFileLockSync(this.#ledgerPath, () => {
      const current = readLedgerStateSync(this.#ledgerPath);
      writeLedgerStateSync(this.#ledgerPath, transform(current));
    });
  }
}

/**
 * Build a ledger from a validated configuration.
 *
 * @param config Guard configuration, normally from `loadConfig()`.
 * @param logger Optional structured logger.
 * @returns A ready `SpendLedger`.
 */
export function createSpendLedger(config: AiGuardConfig, logger?: StructuredLogger): SpendLedger {
  return new SpendLedger({
    ledgerPath: config.ledgerPath,
    ceilingUsd: config.ceilingUsd,
    maxCallsPerProcess: config.maxCallsPerProcess,
    maxCallsPerWindow: config.maxCallsPerWindow,
    rateWindowMs: config.rateWindowMs,
    ...(logger === undefined ? {} : { logger }),
  });
}

export { createEmptyLedgerState };
