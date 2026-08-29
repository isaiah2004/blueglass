/**
 * The discriminated result type used by every fallible pure function in the domain.
 *
 * Purpose
 *   Rule 6.1.4 forbids exceptions for expected outcomes. "The reader typed a book name
 *   we do not recognise" is an expected outcome, not a crash, so parsing and resolution
 *   functions return a `Result` the caller must branch on. TypeScript's exhaustiveness
 *   checking then makes forgetting the failure branch a compile error rather than a
 *   runtime `undefined`.
 *
 * Key responsibilities
 *   - Define the two-armed union every parser in `@atlas/shared` returns.
 *   - Provide the two constructors, so no call site hand-writes `{ ok: true, ... }`.
 *
 * Dependencies
 *   None. This module is the bottom of the dependency graph.
 *
 * Usage
 *   ```ts
 *   const resolved = bookFromAny('1jn');
 *   if (!resolved.ok) {
 *     return renderUnknownBook(resolved.error.message);
 *   }
 *   openReader(resolved.value);
 *   ```
 */

/** A successful outcome carrying the produced value. */
export interface SuccessResult<TValue> {
  readonly ok: true;
  readonly value: TValue;
}

/** A failed outcome carrying a structured, machine-readable error. */
export interface FailureResult<TError> {
  readonly ok: false;
  readonly error: TError;
}

/**
 * The outcome of an operation that can fail in an expected way.
 *
 * Narrow it with `if (result.ok)`. Both arms are readonly, so a result can be passed
 * across layers without a defensive copy.
 */
export type Result<TValue, TError> = SuccessResult<TValue> | FailureResult<TError>;

/**
 * Wrap a produced value as a successful result.
 *
 * @param value - The value the operation produced.
 * @returns A frozen success arm. Side effects: none.
 */
export function succeed<TValue>(value: TValue): SuccessResult<TValue> {
  return { ok: true, value };
}

/**
 * Wrap a structured error as a failed result.
 *
 * @param error - Why the operation could not produce a value.
 * @returns A frozen failure arm. Side effects: none.
 */
export function fail<TError>(error: TError): FailureResult<TError> {
  return { ok: false, error };
}
