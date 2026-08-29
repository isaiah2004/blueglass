/**
 * Durable persistence for the spend ledger.
 *
 * Purpose
 *   Own the on-disk shape of the ledger and the two operations that touch it: a validating
 *   read and an atomic write. `ledger.ts` holds the policy; this module holds the bytes.
 *
 * Key responsibilities
 *   - Define `LedgerState` and validate anything read from disk against it.
 *   - Fail closed: a missing file means "nothing spent", but an unreadable or malformed one
 *     means "refuse to spend", never "assume zero".
 *   - Write through `writeFileAtomicSync`, so the file is never observed half-written.
 *
 * Why "missing" and "corrupt" are treated differently
 *   A missing ledger is the ordinary first-run case and must not block work. A corrupt one
 *   is indistinguishable from a ledger someone truncated, and treating it as $0 would hand
 *   any process that can damage the file a way to reset the budget. So corruption stops
 *   everything until a human looks.
 *
 * Dependencies
 *   `node:fs`, `internal-fs`, and the package's error types. No clock, no policy.
 */

import { readFileSync } from 'node:fs';
import { LedgerUnavailableError } from './errors';
import { errorCode, writeFileAtomicSync } from './internal-fs';

/**
 * On-disk format version.
 *
 * A mismatch is refused rather than migrated: a silent migration of a money record is a
 * worse outcome than a loud stop with instructions.
 */
export const LEDGER_SCHEMA_VERSION = 1;

/** A reservation that has been debited but not yet settled. */
export interface ReservationRecord {
  /** Pessimistic USD held against the ceiling until the call settles. */
  readonly reservedUsd: number;
  /** Logical task, for diagnosis of a wedged ledger. */
  readonly task: string;
  readonly createdAtMs: number;
}

/** The complete persisted ledger. */
export interface LedgerState {
  readonly schemaVersion: number;
  /** Settled spend, in USD, across every process that has ever used this file. */
  readonly committedUsd: number;
  /** Provider calls that have been reserved. Diagnostic only; never used for limits. */
  readonly callCount: number;
  /** Open reservations by id. Their sum is money that is spoken for but not yet settled. */
  readonly openReservations: Readonly<Record<string, ReservationRecord>>;
}

/** The state of a ledger that has never been written. */
export function createEmptyLedgerState(): LedgerState {
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    committedUsd: 0,
    callCount: 0,
    openReservations: {},
  };
}

/** Narrow an unknown parsed value to a `ReservationRecord`. */
function isReservationRecord(candidate: unknown): candidate is ReservationRecord {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const record = candidate as Partial<Record<keyof ReservationRecord, unknown>>;
  return (
    typeof record.reservedUsd === 'number' &&
    Number.isFinite(record.reservedUsd) &&
    typeof record.task === 'string' &&
    typeof record.createdAtMs === 'number'
  );
}

/** Narrow an unknown parsed value to a `LedgerState`. */
function isLedgerState(candidate: unknown): candidate is LedgerState {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const state = candidate as Partial<Record<keyof LedgerState, unknown>>;
  if (
    typeof state.schemaVersion !== 'number' ||
    typeof state.committedUsd !== 'number' ||
    !Number.isFinite(state.committedUsd) ||
    state.committedUsd < 0 ||
    typeof state.callCount !== 'number' ||
    typeof state.openReservations !== 'object' ||
    state.openReservations === null
  ) {
    return false;
  }
  return Object.values(state.openReservations).every(isReservationRecord);
}

/**
 * Read and validate the ledger.
 *
 * @param ledgerPath Path to the ledger file.
 * @returns The persisted state, or a fresh empty state when the file does not exist yet.
 * @throws {LedgerUnavailableError} If the file exists but cannot be read, parsed, or
 *         validated, or if its schema version is not the one this code understands.
 */
export function readLedgerStateSync(ledgerPath: string): LedgerState {
  let text: string;
  try {
    text = readFileSync(ledgerPath, 'utf8');
  } catch (readError) {
    if (errorCode(readError) === 'ENOENT') {
      return createEmptyLedgerState();
    }
    throw new LedgerUnavailableError(
      `Spend ledger at "${ledgerPath}" could not be read. Refusing to spend.`,
      { cause: readError },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (parseError) {
    throw new LedgerUnavailableError(
      `Spend ledger at "${ledgerPath}" is not valid JSON. Refusing to spend; ` +
        `inspect the file, then delete it deliberately if the recorded spend is truly zero.`,
      { cause: parseError },
    );
  }

  if (!isLedgerState(parsed)) {
    throw new LedgerUnavailableError(
      `Spend ledger at "${ledgerPath}" does not match the expected shape. Refusing to spend.`,
    );
  }
  if (parsed.schemaVersion !== LEDGER_SCHEMA_VERSION) {
    throw new LedgerUnavailableError(
      `Spend ledger at "${ledgerPath}" is schema version ${parsed.schemaVersion}; ` +
        `this build understands version ${LEDGER_SCHEMA_VERSION}. Refusing to spend.`,
    );
  }
  return parsed;
}

/**
 * Persist the ledger atomically.
 *
 * @param ledgerPath Path to write.
 * @param state      State to persist.
 * @throws {LedgerUnavailableError} If the write fails. The previous file is left intact.
 */
export function writeLedgerStateSync(ledgerPath: string, state: LedgerState): void {
  try {
    writeFileAtomicSync(ledgerPath, `${JSON.stringify(state, null, 2)}\n`);
  } catch (writeError) {
    throw new LedgerUnavailableError(
      `Spend ledger at "${ledgerPath}" could not be written. Refusing to continue.`,
      { cause: writeError },
    );
  }
}

/** Total USD currently held by open reservations. */
export function sumOpenReservations(state: LedgerState): number {
  return Object.values(state.openReservations).reduce(
    (total, reservation) => total + reservation.reservedUsd,
    0,
  );
}
