/**
 * A cross-process advisory file lock, acquired synchronously.
 *
 * Purpose
 *   The spend ledger is one file shared by every process that can spend money: the API
 *   server, a pre-compute script, and a Vitest run fanned out across worker processes. A
 *   read-modify-write on that file must be serialised across all of them, or two processes
 *   can each read "$0.09 committed", each decide there is room, and each spend.
 *
 * Key responsibilities
 *   - Acquire exclusive ownership of `<path>.lock`, or fail.
 *   - Break a lock left behind by a crashed process, after a stale timeout.
 *   - Always release, including when the guarded function throws.
 *
 * How exclusion works
 *   `open(path, 'wx')` fails with `EEXIST` if the file exists. On every mainstream
 *   filesystem that check-and-create is atomic, so exactly one caller wins the race.
 *
 * Fail closed
 *   If the lock cannot be taken within `LOCK_TIMEOUT_MS`, this throws rather than proceeding
 *   unlocked. An unserialised ledger update is precisely the hole this package exists to
 *   close, so waiting forever and giving up loudly both beat carrying on.
 *
 * Dependencies
 *   `node:fs`, plus `internal-fs` for `sleepSync` and errno inspection.
 */

import { closeSync, openSync, statSync } from 'node:fs';
import { errorCode, ensureDirectorySync, removeIfPresentSync, sleepSync } from './internal-fs';
import { dirname } from 'node:path';

/** How long to keep trying before giving up and throwing. */
const LOCK_TIMEOUT_MS = 10_000;

/** Pause between acquisition attempts. Short, because the critical section is microseconds. */
const LOCK_POLL_INTERVAL_MS = 5;

/**
 * Age at which a lock file is presumed to belong to a dead process and is broken.
 *
 * Must comfortably exceed the longest legitimate critical section (a few file reads and one
 * rename) while staying short enough that a crashed pre-compute run does not wedge the
 * ledger for a developer's whole afternoon.
 */
const STALE_LOCK_MS = 30_000;

/**
 * Run `criticalSection` while holding an exclusive lock on `targetPath`.
 *
 * The callback must be synchronous. An `async` callback would return a pending promise and
 * the lock would be released before the work finished, which would silently reintroduce the
 * race this function exists to prevent — hence the `() => T` signature rather than
 * `() => Promise<T>`.
 *
 * @param targetPath      File being protected. The lock lives at `<targetPath>.lock`.
 * @param criticalSection Synchronous work to perform under the lock.
 * @returns Whatever `criticalSection` returns.
 * @throws {Error} `LOCK_ACQUISITION_TIMEOUT` when the lock cannot be taken in time, or
 *                 anything `criticalSection` throws (after the lock is released).
 */
export function withFileLockSync<T>(targetPath: string, criticalSection: () => T): T {
  const lockPath = `${targetPath}.lock`;
  ensureDirectorySync(dirname(targetPath));
  acquireLockSync(lockPath);
  try {
    return criticalSection();
  } finally {
    removeIfPresentSync(lockPath);
  }
}

/**
 * Spin until the lock file is ours.
 *
 * @param lockPath Lock file to create.
 * @throws {Error} When `LOCK_TIMEOUT_MS` elapses without acquisition.
 */
function acquireLockSync(lockPath: string): void {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  for (;;) {
    try {
      // 'wx' = create-exclusive. Fails with EEXIST if another holder got there first.
      const descriptor = openSync(lockPath, 'wx');
      closeSync(descriptor);
      return;
    } catch (openError) {
      if (errorCode(openError) !== 'EEXIST') {
        throw openError;
      }
    }

    breakLockIfStale(lockPath);

    if (Date.now() >= deadline) {
      const timeoutError = new Error(
        `LOCK_ACQUISITION_TIMEOUT: could not lock "${lockPath}" within ${LOCK_TIMEOUT_MS}ms.`,
      );
      throw timeoutError;
    }
    sleepSync(LOCK_POLL_INTERVAL_MS);
  }
}

/**
 * Remove a lock file older than `STALE_LOCK_MS`.
 *
 * A crashed holder never unlinks its lock, so without this the ledger would be permanently
 * unusable after one hard kill. The timeout is long enough that breaking a *live* lock is
 * not a realistic outcome.
 */
function breakLockIfStale(lockPath: string): void {
  try {
    const stats = statSync(lockPath);
    if (Date.now() - stats.mtimeMs > STALE_LOCK_MS) {
      removeIfPresentSync(lockPath);
    }
  } catch (statError) {
    // The holder released it between our open and our stat. That is the happy path; the
    // next loop iteration will take the lock. Any other error is real and must surface.
    if (errorCode(statError) !== 'ENOENT') {
      throw statError;
    }
  }
}
