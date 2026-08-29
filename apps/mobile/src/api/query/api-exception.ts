/**
 * The one place a typed API failure becomes a thrown exception.
 *
 * Purpose
 *   `src/api/client` resolves an {@link ApiResult} and never throws, which is what rules
 *   6.1.3 and 6.1.4 ask for. TanStack Query, on the other hand, decides a query failed
 *   by catching what its `queryFn` throws — there is no result-shaped seam in it. Both
 *   are right for their own layer, so something has to bridge them, and it is better
 *   that the bridge is one named module than a `throw` scattered through eleven hooks.
 *
 * The rule
 *   **Nothing but a `queryFn` may throw this, and nothing outside `src/api/query` may
 *   catch it.** A component reads `query.error` — already typed as this class — and
 *   branches on `.failure.kind`. That keeps rule 6.2.4's "map at the adapter boundary"
 *   intact: the boundary is here, and it is two functions wide.
 *
 * Why it extends `Error`
 *   React error boundaries, the query devtools, and every logger in the ecosystem
 *   inspect `Error`. A plain object thrown through them loses its message and its stack.
 *   The typed failure rides along on {@link AtlasApiException.failure}, untouched.
 *
 * Dependencies
 *   `../client` for the error vocabulary.
 */

import { describeApiError, type ApiError, type ApiResult } from '../client';

/** A failed API call, in the form a query cache understands. */
export class AtlasApiException extends Error {
  /** The typed failure. Branch on `.kind`; never parse `.message`. */
  readonly failure: ApiError;

  constructor(failure: ApiError) {
    super(failure.message);
    this.name = 'AtlasApiException';
    this.failure = failure;
  }

  /** A secret-free one-liner for a log. Not for the reader; use `message` for that. */
  describe(): string {
    return describeApiError(this.failure);
  }
}

/**
 * Unwrap a result for a `queryFn`, throwing the failure arm.
 *
 * @param result - What the API call resolved with.
 * @returns The value, when the call succeeded.
 * @throws {AtlasApiException} When it did not. Side effects: none.
 */
export function unwrapForQuery<TValue>(result: ApiResult<TValue>): TValue {
  if (result.ok) return result.value;
  throw new AtlasApiException(result.error);
}

/**
 * Recover the typed failure from whatever a query reported.
 *
 * A query's `error` is `unknown` as far as the type system is concerned — anything a
 * `queryFn` throws lands there, including a `TypeError` from a bug in the hook. This
 * narrows the expected case and leaves the rest to the caller.
 *
 * @param error - A query's `error` field.
 * @returns The typed failure, or `null` when the throw came from somewhere else.
 *          Side effects: none.
 */
export function toApiError(error: unknown): ApiError | null {
  return error instanceof AtlasApiException ? error.failure : null;
}
