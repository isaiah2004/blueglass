/**
 * Result unwrapping for tests.
 *
 * Purpose
 *   Production code branches on `result.ok`, because a failure there is a state the UI
 *   has to render (rule 6.1.4). A test asserting the happy path wants the opposite: if
 *   the result is a failure the test should stop immediately with a message naming the
 *   error, not continue against `undefined`. This module draws that line explicitly.
 *
 * Key responsibilities
 *   - Narrow a `Result` to its value, throwing a described error when it is a failure.
 *   - Narrow a `Result` to its error, throwing when it unexpectedly succeeded.
 *
 * Scope
 *   Test-only. It is deliberately **not** re-exported from `src/index.ts`, so no shipped
 *   code can reach for it and reintroduce exceptions as control flow.
 *
 * Dependencies
 *   `../result` only. No test framework import, so it stays runner-agnostic.
 */

import type { Result } from '../result';

/**
 * Take the value of a result that is expected to have succeeded.
 *
 * @param result - The result under test.
 * @returns The success value.
 * @throws Error - When the result is a failure; the message embeds the serialised error
 *                 so the test report names the actual cause, not `undefined`.
 */
export function unwrapValue<TValue, TError>(result: Result<TValue, TError>): TValue {
  if (!result.ok) {
    throw new Error(`Expected a successful result, got: ${JSON.stringify(result.error)}`);
  }

  return result.value;
}

/**
 * Take the error of a result that is expected to have failed.
 *
 * @param result - The result under test.
 * @returns The failure error.
 * @throws Error - When the result unexpectedly succeeded.
 */
export function unwrapError<TValue, TError>(result: Result<TValue, TError>): TError {
  if (result.ok) {
    throw new Error(`Expected a failed result, got: ${JSON.stringify(result.value)}`);
  }

  return result.error;
}
