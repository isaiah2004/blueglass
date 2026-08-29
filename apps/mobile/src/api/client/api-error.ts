/**
 * The one failure vocabulary every API call resolves with.
 *
 * Purpose
 *   Rule 6.1.3 forbids `throw new Error('request failed')` and rule 6.1.4 forbids using
 *   exceptions for expected outcomes — and "the reader is on a train and the tunnel ate
 *   the request" is the most expected outcome this layer has. So no function in
 *   `src/api/client` throws: they resolve an {@link ApiResult}, and its failure arm is
 *   one of the five shapes below.
 *
 * Why five kinds and not one code enum
 *   Each kind carries different evidence and earns a different response from the UI:
 *
 *   | kind        | what happened                        | what the UI does            |
 *   |-------------|--------------------------------------|-----------------------------|
 *   | `timeout`   | the budget elapsed with no response  | offer Retry                 |
 *   | `network`   | the request never completed          | offer Retry, show offline   |
 *   | `aborted`   | the caller cancelled                 | render nothing              |
 *   | `http`      | the server answered, non-2xx         | show the server's message   |
 *   | `malformed` | the body did not match the contract  | report a bug; never retry   |
 *
 *   Folding those into one string code would force every call site to re-derive the
 *   table above from a substring match.
 *
 * Key responsibilities
 *   - Define the union, and the constructors that are the only way to build one.
 *   - Carry `isRetryable` as data, so the retry policy and the UI agree by construction
 *     rather than by two copies of the same `switch`.
 *   - Keep user content out. No error here carries a request body or a query string:
 *     rule 7.1.4 keeps user content away from anything that may reach a log.
 *
 * Dependencies
 *   None.
 */

/** Which of the five failures this is. Narrow on it; the union is exhaustive. */
export type ApiErrorKind = 'timeout' | 'network' | 'aborted' | 'http' | 'malformed';

/** What every failure carries, whatever its kind. */
interface ApiErrorCommon {
  readonly kind: ApiErrorKind;
  /**
   * Human-readable and safe to display.
   *
   * For `http` this is the server's own `error.message`, which the API contract
   * guarantees is display-safe; for the rest it is written here.
   */
  readonly message: string;
  /** Whether a further attempt could plausibly succeed. Drives both retry and the UI. */
  readonly isRetryable: boolean;
  /** Attempts made before giving up. `1` when nothing was retried. */
  readonly attempts: number;
}

/** The request exceeded its time budget (rule 6.4.1: no indefinite waits). */
export interface ApiTimeoutError extends ApiErrorCommon {
  readonly kind: 'timeout';
  /** The budget that elapsed, in milliseconds. */
  readonly timeoutMs: number;
}

/** The request never reached a server, or the connection dropped. */
export interface ApiNetworkError extends ApiErrorCommon {
  readonly kind: 'network';
  /** Whatever `fetch` rejected with, preserved for diagnosis (rule 6.2.2). */
  readonly cause: unknown;
}

/**
 * The caller cancelled — a new search keystroke, a chapter change, an unmount.
 *
 * Expected control flow rather than a fault, which is why `isRetryable` is `false`:
 * "retryable" here means "worth trying again by itself", and a cancelled request should
 * never come back on its own.
 */
export interface ApiAbortedError extends ApiErrorCommon {
  readonly kind: 'aborted';
}

/**
 * The server answered with a non-2xx status and (usually) the API's error envelope.
 *
 * `code` is the server's stable machine-readable code — `chapter_not_found`,
 * `identity_required`, `validation_error`. Branch on it, never on `message`.
 */
export interface ApiHttpError extends ApiErrorCommon {
  readonly kind: 'http';
  readonly status: number;
  /** The envelope's `error.code`, or `http_error` when the body was not an envelope. */
  readonly code: string;
  /** The envelope's `error.details`. Empty when absent. */
  readonly details: Readonly<Record<string, unknown>>;
  /** The envelope's `error.request_id`, for correlating with the server's logs. */
  readonly requestId: string | null;
}

/**
 * The body parsed as JSON but did not match the endpoint's contract.
 *
 * Never retryable: the same request would produce the same body. This is the shape that
 * fires when the client and the API drift, and it names the offending path so the drift
 * is one grep away.
 */
export interface ApiMalformedResponseError extends ApiErrorCommon {
  readonly kind: 'malformed';
  /** Where the body went wrong, e.g. `chapter.verses[3].verse_key`. */
  readonly path: string;
  /** What the decoder wanted there, e.g. `a number`. */
  readonly expected: string;
}

/** Every way an API call can fail. */
export type ApiError =
  | ApiTimeoutError
  | ApiNetworkError
  | ApiAbortedError
  | ApiHttpError
  | ApiMalformedResponseError;

/** Build a {@link ApiTimeoutError}. */
export function timeoutError(timeoutMs: number, attempts = 1): ApiTimeoutError {
  return {
    kind: 'timeout',
    message: 'The server took too long to answer.',
    isRetryable: true,
    attempts,
    timeoutMs,
  };
}

/** Build a {@link ApiNetworkError}, preserving whatever the transport rejected with. */
export function networkError(cause: unknown, attempts = 1): ApiNetworkError {
  return {
    kind: 'network',
    message: 'Could not reach the server. Check your connection.',
    isRetryable: true,
    attempts,
    cause,
  };
}

/** Build an {@link ApiAbortedError}. */
export function abortedError(attempts = 1): ApiAbortedError {
  return {
    kind: 'aborted',
    message: 'The request was cancelled.',
    isRetryable: false,
    attempts,
  };
}

/** Fields a caller supplies when the server answered with an error. */
export interface HttpErrorFields {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly requestId?: string | null;
}

/**
 * Build an {@link ApiHttpError}.
 *
 * Retryability is derived from the status rather than passed in, so one rule decides it
 * for the whole app: `408`, `429` and `5xx` may be tried again; every `4xx` below them
 * is the client's own fault and would fail identically.
 */
export function httpError(fields: HttpErrorFields, attempts = 1): ApiHttpError {
  return {
    kind: 'http',
    message: fields.message,
    isRetryable: isRetryableStatus(fields.status),
    attempts,
    status: fields.status,
    code: fields.code,
    details: fields.details ?? {},
    requestId: fields.requestId ?? null,
  };
}

/** Build an {@link ApiMalformedResponseError}. */
export function malformedResponseError(
  path: string,
  expected: string,
  attempts = 1,
): ApiMalformedResponseError {
  return {
    kind: 'malformed',
    message: 'The server sent a response this app does not understand.',
    isRetryable: false,
    attempts,
    path,
    expected,
  };
}

/**
 * Is another attempt at this status worth making?
 *
 * @param status - The HTTP status the server returned.
 * @returns `true` for `408`, `429` and `5xx`. Side effects: none.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Restate an error with the number of attempts that were actually made.
 *
 * The retry runner uses this: the underlying failure is built by whichever attempt
 * produced it and knows nothing about the ones before it.
 *
 * @param error - The failure to restate.
 * @param attempts - Total attempts made, including the first.
 * @returns A copy carrying the new count. Side effects: none.
 */
export function withAttempts(error: ApiError, attempts: number): ApiError {
  return { ...error, attempts };
}
