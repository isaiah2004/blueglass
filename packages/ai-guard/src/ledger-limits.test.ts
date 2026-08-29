/**
 * Tests for the spend ledger — concurrency, the rate cap, and settlement.
 *
 * Purpose
 *   Prove that concurrent callers cannot race past the ceiling, that the per-process rate
 *   cap stops a tight loop long before the money does, and that a reservation can be settled
 *   exactly once.
 *
 * The ceiling itself, crash safety, and failing closed live in `ledger.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ABSOLUTE_MAX_CEILING_USD } from './config';
import {
  BudgetExhaustedError,
  ConfigInvalidError,
  InvalidReservationError,
  RateLimitExceededError,
} from './errors';
import type { SpendLedger } from './ledger';
import {
  buildTestLedger,
  createTemporaryWorkspace,
  type TemporaryWorkspace,
} from './testing/test-support';

let workspace: TemporaryWorkspace;

beforeEach(() => {
  workspace = createTemporaryWorkspace();
});

afterEach(() => {
  workspace.cleanup();
});

describe('SpendLedger — concurrency', () => {
  it('cannot be raced past the ceiling by concurrent callers', async () => {
    const ceilingUsd = 0.01;
    const costPerCallUsd = 0.002;
    const ledger = buildTestLedger(workspace, { ceilingUsd });

    const outcomes = await Promise.all(
      Array.from({ length: 50 }, async () => {
        // Yield first so all fifty callers are genuinely interleaved on the event loop.
        await Promise.resolve();
        try {
          const reservation = ledger.reserve('classify_cheap', costPerCallUsd);
          await Promise.resolve();
          ledger.commit(reservation, costPerCallUsd);
          return 'granted' as const;
        } catch (failure) {
          expect(failure).toBeInstanceOf(BudgetExhaustedError);
          return 'refused' as const;
        }
      }),
    );

    const granted = outcomes.filter((outcome) => outcome === 'granted').length;
    expect(granted).toBeGreaterThan(0);
    expect(granted * costPerCallUsd).toBeLessThanOrEqual(ceilingUsd);
    expect(ledger.snapshot().committedUsd).toBeLessThanOrEqual(ceilingUsd);
    expect(ledger.snapshot().openReservationCount).toBe(0);
  });

  it('serialises two ledger instances sharing one file', async () => {
    const ceilingUsd = 0.01;
    const costPerCallUsd = 0.002;
    const first = buildTestLedger(workspace, { ceilingUsd });
    const second = buildTestLedger(workspace, { ceilingUsd });

    const attempt = async (ledger: SpendLedger): Promise<'granted' | 'refused'> => {
      await Promise.resolve();
      try {
        ledger.commit(ledger.reserve('classify_cheap', costPerCallUsd), costPerCallUsd);
        return 'granted';
      } catch {
        return 'refused';
      }
    };

    const outcomes = await Promise.all(
      Array.from({ length: 20 }, (_unused, index) => attempt(index % 2 === 0 ? first : second)),
    );

    const granted = outcomes.filter((outcome) => outcome === 'granted').length;
    expect(granted * costPerCallUsd).toBeLessThanOrEqual(ceilingUsd);
    expect(first.snapshot().committedUsd).toBeLessThanOrEqual(ceilingUsd);
  });
});

describe('SpendLedger — the per-process rate cap', () => {
  it('stops a tight loop on call count long before the money runs out', () => {
    const ledger = buildTestLedger(workspace, { ceilingUsd: 2, maxCallsPerProcess: 25 });

    let granted = 0;
    let refusal: unknown = null;
    for (let attempt = 0; attempt < 500; attempt += 1) {
      try {
        ledger.commit(ledger.reserve('classify_cheap', 0.0000001), 0.0000001);
        granted += 1;
      } catch (failure) {
        refusal = failure;
        break;
      }
    }

    expect(granted).toBe(25);
    expect(refusal).toBeInstanceOf(RateLimitExceededError);
    expect((refusal as RateLimitExceededError).limitKind).toBe('process_total');
    // The budget is nowhere near exhausted — the rate cap is what stopped it.
    expect(ledger.snapshot().committedUsd).toBeLessThan(0.001);
  });

  it('enforces a sliding window against a burst', () => {
    let clockMs = 1_000;
    const ledger = buildTestLedger(workspace, {
      ceilingUsd: 2,
      maxCallsPerWindow: 5,
      rateWindowMs: 1_000,
      now: () => clockMs,
    });

    for (let index = 0; index < 5; index += 1) {
      ledger.commit(ledger.reserve('classify_cheap', 0.0000001), 0.0000001);
    }
    expect(() => ledger.reserve('classify_cheap', 0.0000001)).toThrow(RateLimitExceededError);

    // Advance past the window; the burst ages out and the caller is allowed again.
    clockMs += 1_001;
    expect(() => ledger.reserve('classify_cheap', 0.0000001)).not.toThrow();
  });

  it('does not spend rate quota on a call the budget refused', () => {
    const ledger = buildTestLedger(workspace, { ceilingUsd: 0.001, maxCallsPerProcess: 3 });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(() => ledger.reserve('editorial', 1)).toThrow(BudgetExhaustedError);
    }
    // Quota is intact, so a call that fits still goes through.
    expect(() => ledger.reserve('editorial', 0.0005)).not.toThrow();
  });

  it('does not share its rate quota with a second process', () => {
    // The rate cap is per process by design; the money ceiling is the cross-process one.
    const first = buildTestLedger(workspace, { ceilingUsd: 2, maxCallsPerProcess: 2 });
    first.commit(first.reserve('classify_cheap', 0.0000001), 0.0000001);
    first.commit(first.reserve('classify_cheap', 0.0000001), 0.0000001);
    expect(() => first.reserve('classify_cheap', 0.0000001)).toThrow(RateLimitExceededError);

    const second = buildTestLedger(workspace, { ceilingUsd: 2, maxCallsPerProcess: 2 });
    expect(() => second.reserve('classify_cheap', 0.0000001)).not.toThrow();
  });
});

describe('SpendLedger — settlement', () => {
  it('refuses to settle the same reservation twice', () => {
    const ledger = buildTestLedger(workspace);
    const reservation = ledger.reserve('classify_cheap', 0.001);
    ledger.commit(reservation, 0.0005);

    expect(() => ledger.commit(reservation, 0.0005)).toThrow(InvalidReservationError);
    expect(ledger.snapshot().committedUsd).toBeCloseTo(0.0005, 12);
  });

  it('releases a reservation without charging for it', () => {
    const ledger = buildTestLedger(workspace);
    const reservation = ledger.reserve('classify_cheap', 0.001);
    ledger.release(reservation);

    const snapshot = ledger.snapshot();
    expect(snapshot.committedUsd).toBe(0);
    expect(snapshot.openReservationCount).toBe(0);
  });

  it('refuses to release a reservation that was already committed', () => {
    const ledger = buildTestLedger(workspace);
    const reservation = ledger.reserve('classify_cheap', 0.001);
    ledger.commit(reservation, 0.0005);

    expect(() => ledger.release(reservation)).toThrow(InvalidReservationError);
  });

  it('records the real cost, not the reservation, when the call comes in cheaper', () => {
    const ledger = buildTestLedger(workspace);
    ledger.commit(ledger.reserve('extract_structured', 0.000142), 0.0000749);
    expect(ledger.snapshot().committedUsd).toBeCloseTo(0.0000749, 12);
  });

  it('falls back to the full reservation when the reported cost is not a number', () => {
    const ledger = buildTestLedger(workspace);
    ledger.commit(ledger.reserve('extract_structured', 0.000142), Number.NaN);
    expect(ledger.snapshot().committedUsd).toBeCloseTo(0.000142, 12);
  });

  it('records an over-billed call truthfully, then refuses every call after it', () => {
    // The one way committed spend can pass the ceiling: a provider bills more than the
    // pessimistic reservation, because it raised its price or emitted unexpected reasoning
    // tokens. The ledger records the truth rather than hiding it, so the overshoot is
    // bounded by that single call and everything afterwards is refused.
    const ledger = buildTestLedger(workspace, { ceilingUsd: 0.01 });
    ledger.commit(ledger.reserve('editorial', 0.001), 0.05);

    expect(ledger.snapshot().committedUsd).toBe(0.05);
    expect(ledger.snapshot().remainingUsd).toBe(0);
    expect(() => ledger.reserve('editorial', 0.000001)).toThrow(BudgetExhaustedError);
  });
});

describe('SpendLedger — the ceiling cannot be widened at construction', () => {
  it('refuses a ceiling above the absolute maximum, closing the obvious back door', () => {
    // `SpendLedger` is a public export taking a plain options object. Without this check,
    // feature code could sidestep the entire guard with `new SpendLedger({ ceilingUsd: 1000 })`.
    expect(() => buildTestLedger(workspace, { ceilingUsd: 1_000 })).toThrow(ConfigInvalidError);
  });

  it('refuses an infinite ceiling', () => {
    expect(() => buildTestLedger(workspace, { ceilingUsd: Infinity })).toThrow(ConfigInvalidError);
  });

  it('refuses a negative ceiling', () => {
    expect(() => buildTestLedger(workspace, { ceilingUsd: -1 })).toThrow(ConfigInvalidError);
  });

  it('accepts a ceiling exactly at the absolute maximum', () => {
    expect(() =>
      buildTestLedger(workspace, { ceilingUsd: ABSOLUTE_MAX_CEILING_USD }),
    ).not.toThrow();
  });
});
