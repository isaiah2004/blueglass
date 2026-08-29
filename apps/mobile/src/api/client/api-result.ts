/**
 * The result type every API call resolves with, and the few helpers that read it.
 *
 * Purpose
 *   `Result` already exists in `@atlas/shared` and is what the domain's parsers return.
 *   Binding it to {@link ApiError} here gives the network layer the same discipline
 *   without inventing a second convention: one `if (!result.ok)` shape across parsing,
 *   fetching and decoding.
 *
 * Why the failure arm is never an `Error` instance
 *   TanStack Query, React error boundaries and `Promise.reject` all treat a thrown
 *   `Error` as an unhandled fault. An expected 404 for a chapter with no study notes is
 *   not a fault — the prototype already treated it as `null` rather than an error
 *   (`content_api.dart:69`, port map §5 endpoint 7) — so it must not travel as one.
 *
 * Dependencies
 *   `@atlas/shared` for `Result`, and `api-error.ts`.
 */

import { fail, succeed, type Result } from '@atlas/shared';

import type { ApiError } from './api-error';

/** What every request resolves with. Branch on `.ok`; never assume. */
export type ApiResult<TValue> = Result<TValue, ApiError>;

/** Wrap a decoded payload as a successful call. */
export const apiSuccess = succeed;

/** Wrap a failure as a failed call. */
export const apiFailure = fail;

/**
 * Turn a "this is a normal empty state" HTTP code into a success carrying `null`.
 *
 * Three endpoints need this. `GET /study/{book}/{chapter}` answers `404` when a chapter
 * simply has no study notes yet, and a reader who opens Obadiah has not hit an error.
 * Wrapping the whole result rather than special-casing inside each endpoint keeps the
 * decision — "which status is an empty state here" — at the call site where the product
 * meaning lives.
 *
 * @param result - The call's result.
 * @param emptyStatus - The status to reinterpret. Defaults to `404`.
 * @returns The value, `null` for the empty state, or the original failure.
 *          Side effects: none.
 */
export function emptyOnStatus<TValue>(
  result: ApiResult<TValue>,
  emptyStatus = 404,
): ApiResult<TValue | null> {
  if (result.ok) return result;
  if (result.error.kind === 'http' && result.error.status === emptyStatus) {
    return succeed(null);
  }
  return result;
}

/**
 * A one-line description of a failure, for a log line or a developer-facing surface.
 *
 * Not for the reader: `message` is the display string. This adds the machine-readable
 * part — status, code, path — that a person debugging needs and a reader does not.
 *
 * @param error - The failure to describe.
 * @returns A short, secret-free string. Side effects: none.
 */
export function describeApiError(error: ApiError): string {
  switch (error.kind) {
    case 'timeout':
      return `timeout after ${String(error.timeoutMs)}ms (${String(error.attempts)} attempts)`;
    case 'network':
      return `network failure (${String(error.attempts)} attempts)`;
    case 'aborted':
      return 'cancelled by the caller';
    case 'http':
      return `HTTP ${String(error.status)} ${error.code}`;
    case 'malformed':
      return `malformed response at ${error.path}: expected ${error.expected}`;
  }
}
