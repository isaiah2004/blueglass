/**
 * Tests for the spend ledger — the ceiling, crash safety, and failing closed.
 *
 * Purpose
 *   Prove the three claims the whole package rests on: a runaway loop stops at the ceiling,
 *   a crash cannot lose a reservation, and a damaged ledger refuses to spend rather than
 *   reading as zero.
 *
 * Concurrency, the rate cap, and settlement live in `ledger-limits.test.ts`.
 *
 * No network, no money
 *   Nothing here constructs a provider. The ledger is pure arithmetic over a file.
 */

import { writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BudgetExhaustedError, LedgerUnavailableError } from './errors';
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

describe('SpendLedger — the hard ceiling', () => {
  it('stops a loop of 10,000 calls at a $0.10 ceiling and throws BudgetExhaustedError', () => {
    const ceilingUsd = 0.1;
    const costPerCallUsd = 0.001;
    const ledger = buildTestLedger(workspace, { ceilingUsd });

    // Mirror the ledger's own floating-point accumulation so the expected grant count is
    // exact rather than approximate.
    let expectedGrants = 0;
    for (let running = 0; running + costPerCallUsd <= ceilingUsd; running += costPerCallUsd) {
      expectedGrants += 1;
    }

    let granted = 0;
    let refused = 0;
    let lastRefusal: unknown = null;

    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      try {
        const reservation = ledger.reserve('classify_cheap', costPerCallUsd);
        granted += 1;
        ledger.commit(reservation, costPerCallUsd);
      } catch (failure) {
        refused += 1;
        lastRefusal = failure;
      }
    }

    expect(granted).toBe(expectedGrants);
    expect(refused).toBe(10_000 - expectedGrants);
    expect(lastRefusal).toBeInstanceOf(BudgetExhaustedError);
    expect(ledger.snapshot().committedUsd).toBeLessThanOrEqual(ceilingUsd);
  }, 60_000);

  it('never lets exposure at reservation time exceed the ceiling', () => {
    // The invariant the ceiling actually guarantees, stated directly: no reservation is ever
    // granted that would take committed-plus-reserved past the ceiling.
    const ceilingUsd = 0.01;
    const ledger = buildTestLedger(workspace, { ceilingUsd });

    for (let attempt = 0; attempt < 300; attempt += 1) {
      try {
        const reservation = ledger.reserve('classify_cheap', 0.0007);
        expect(ledger.snapshot().exposureUsd).toBeLessThanOrEqual(ceilingUsd);
        ledger.commit(reservation, 0.0003);
      } catch (failure) {
        expect(failure).toBeInstanceOf(BudgetExhaustedError);
      }
      expect(ledger.snapshot().exposureUsd).toBeLessThanOrEqual(ceilingUsd);
    }
  }, 60_000);

  it('refuses a single call that would cross the ceiling on its own', () => {
    const ledger = buildTestLedger(workspace, { ceilingUsd: 0.01 });
    expect(() => ledger.reserve('editorial', 0.011)).toThrow(BudgetExhaustedError);
    expect(ledger.snapshot().exposureUsd).toBe(0);
    expect(ledger.snapshot().callCount).toBe(0);
  });

  it('carries the ceiling across process restarts, because the total is on disk', () => {
    const first = buildTestLedger(workspace, { ceilingUsd: 0.01 });
    first.commit(first.reserve('classify_cheap', 0.009), 0.009);

    // A brand new instance models a brand new process reading the same shared file.
    const second = buildTestLedger(workspace, { ceilingUsd: 0.01 });
    expect(second.snapshot().committedUsd).toBeCloseTo(0.009, 12);
    expect(() => second.reserve('classify_cheap', 0.005)).toThrow(BudgetExhaustedError);
  });

  it('reports the ceiling, the exposure, and the shortfall on the error it throws', () => {
    const ledger = buildTestLedger(workspace, { ceilingUsd: 0.02 });
    ledger.commit(ledger.reserve('editorial', 0.015), 0.015);

    try {
      ledger.reserve('editorial', 0.01);
      expect.unreachable('reserve should have thrown');
    } catch (failure) {
      expect(failure).toBeInstanceOf(BudgetExhaustedError);
      const budgetFailure = failure as BudgetExhaustedError;
      expect(budgetFailure.code).toBe('BUDGET_EXHAUSTED');
      expect(budgetFailure.ceilingUsd).toBe(0.02);
      expect(budgetFailure.requestedUsd).toBe(0.01);
      expect(budgetFailure.exposureUsd).toBeCloseTo(0.015, 12);
    }
  });
});

describe('SpendLedger — crash safety', () => {
  it('keeps a reservation that was never committed, so a crash cannot lose the money', () => {
    const beforeCrash = buildTestLedger(workspace, { ceilingUsd: 0.1 });
    beforeCrash.reserve('editorial', 0.02);
    // The process dies here: no commit, no release, no cleanup hook.

    const afterRestart = buildTestLedger(workspace, { ceilingUsd: 0.1 });
    const snapshot = afterRestart.snapshot();

    expect(snapshot.openReservationCount).toBe(1);
    expect(snapshot.committedUsd).toBe(0);
    expect(snapshot.exposureUsd).toBeCloseTo(0.02, 12);
    expect(snapshot.remainingUsd).toBeCloseTo(0.08, 12);
  });

  it('counts an orphaned reservation against the ceiling for every later caller', () => {
    const beforeCrash = buildTestLedger(workspace, { ceilingUsd: 0.1 });
    beforeCrash.reserve('editorial', 0.095);

    const afterRestart = buildTestLedger(workspace, { ceilingUsd: 0.1 });
    expect(() => afterRestart.reserve('editorial', 0.01)).toThrow(BudgetExhaustedError);
  });

  it('leaves no trace on disk when a reservation is refused', () => {
    const ledger = buildTestLedger(workspace, { ceilingUsd: 0.001 });
    expect(() => ledger.reserve('editorial', 0.5)).toThrow(BudgetExhaustedError);
    expect(ledger.snapshot()).toMatchObject({ committedUsd: 0, openReservationCount: 0 });
  });
});

describe('SpendLedger — failing closed', () => {
  it('refuses to spend when the ledger file is corrupt, rather than reading it as $0', () => {
    writeFileSync(workspace.ledgerPath, '{ this is not json', 'utf8');
    const ledger = buildTestLedger(workspace);

    expect(() => ledger.reserve('classify_cheap', 0.0001)).toThrow(LedgerUnavailableError);
    expect(() => ledger.snapshot()).toThrow(LedgerUnavailableError);
  });

  it('refuses to spend when the ledger has an unknown schema version', () => {
    writeFileSync(
      workspace.ledgerPath,
      JSON.stringify({ schemaVersion: 99, committedUsd: 0, callCount: 0, openReservations: {} }),
      'utf8',
    );
    expect(() => buildTestLedger(workspace).reserve('classify_cheap', 0.0001)).toThrow(
      LedgerUnavailableError,
    );
  });

  it('refuses to spend when the recorded total has been tampered into a negative', () => {
    writeFileSync(
      workspace.ledgerPath,
      JSON.stringify({
        schemaVersion: 1,
        committedUsd: -1_000,
        callCount: 0,
        openReservations: {},
      }),
      'utf8',
    );
    expect(() => buildTestLedger(workspace).reserve('classify_cheap', 0.0001)).toThrow(
      LedgerUnavailableError,
    );
  });

  it('treats a missing ledger as zero spend, because that is the ordinary first run', () => {
    expect(buildTestLedger(workspace).snapshot().committedUsd).toBe(0);
  });
});
