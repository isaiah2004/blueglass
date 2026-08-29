/**
 * Synchronous filesystem primitives shared by the ledger and the response cache.
 *
 * Purpose
 *   Both the spend ledger and the cache need a write that is either fully applied or not
 *   applied at all. A half-written ledger is the failure mode that could either lose a
 *   reservation (money leaks) or corrupt the file (the guard fails closed and all work
 *   stops). This module makes that impossible with the write-temp-then-rename pattern.
 *
 * Key responsibilities
 *   - `writeFileAtomicSync` — durable, all-or-nothing file replacement.
 *   - `sleepSync` — block the current thread without an event-loop turn.
 *   - `errorCode` — read a Node errno string off an unknown caught value, type-safely.
 *
 * Why everything here is synchronous
 *   The ledger's read-modify-write must not interleave with another turn of this process's
 *   event loop. Node runs JavaScript on one thread, so a critical section built entirely
 *   from synchronous calls cannot be interrupted by another `await`. That property is what
 *   makes the concurrency test in `ledger.test.ts` pass by construction rather than by luck.
 *
 * Dependencies
 *   `node:fs`, `node:path`, `node:crypto`. Node only — this module is why the package must
 *   never be imported by the Expo client.
 */

import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

/** Bytes of randomness in a temporary filename. Enough that two writers never collide. */
const TEMP_SUFFIX_BYTES = 6;

/**
 * Extract a Node errno code (`'ENOENT'`, `'EEXIST'`, ...) from a caught value.
 *
 * @param error Anything thrown by a `node:fs` call.
 * @returns The code, or `null` when the value is not a Node system error.
 */
export function errorCode(error: unknown): string | null {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return null;
}

/** Create a directory and its parents, tolerating one that already exists. */
export function ensureDirectorySync(directoryPath: string): void {
  mkdirSync(directoryPath, { recursive: true });
}

/**
 * Block this thread for a fixed duration without yielding to the event loop.
 *
 * Used only while spinning for a file lock, which is held for microseconds. Implemented with
 * `Atomics.wait` on a private buffer because Node permits it on the main thread and it does
 * not busy-spin the CPU the way a `while (Date.now() < end)` loop would.
 *
 * @param durationMs How long to block. Values below 1ms return immediately.
 */
export function sleepSync(durationMs: number): void {
  if (durationMs <= 0) {
    return;
  }
  const signal = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  // Waits for the value at index 0 to stop being 0. Nothing ever writes to it, so this
  // always runs the full timeout and then returns 'timed-out'.
  Atomics.wait(signal, 0, 0, durationMs);
}

/**
 * Replace a file's contents atomically and durably.
 *
 * Writes to a uniquely named sibling, flushes it to the storage device, then renames over
 * the destination. `rename` within one directory is atomic on POSIX and on Windows via
 * `MoveFileEx`, so a reader either sees the whole old file or the whole new one — never a
 * truncated one, and never an empty one after a crash mid-write.
 *
 * @param filePath Destination path. Parent directories are created if missing.
 * @param contents UTF-8 text to write.
 * @throws Whatever `node:fs` throws, after the temporary file has been cleaned up.
 */
export function writeFileAtomicSync(filePath: string, contents: string): void {
  ensureDirectorySync(dirname(filePath));
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(TEMP_SUFFIX_BYTES).toString('hex')}.tmp`;

  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporaryPath, 'wx');
    writeSync(descriptor, contents, 0, 'utf8');
    // Flush to disk before the rename, so a power loss cannot leave a renamed-but-empty file.
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    renameSync(temporaryPath, filePath);
  } catch (writeError) {
    if (descriptor !== null) {
      closeSync(descriptor);
    }
    removeIfPresentSync(temporaryPath);
    throw writeError;
  }
}

/**
 * Delete a file, treating "already gone" as success.
 *
 * @param filePath Path to remove.
 * @throws Any filesystem error other than `ENOENT`.
 */
export function removeIfPresentSync(filePath: string): void {
  try {
    unlinkSync(filePath);
  } catch (removeError) {
    if (errorCode(removeError) !== 'ENOENT') {
      throw removeError;
    }
  }
}
