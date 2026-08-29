/**
 * One attempt at one HTTP request: send it, classify what came back, decode it.
 *
 * Purpose
 *   Everything that happens *inside* a single try, separated from the loop that decides
 *   whether there will be another one (`retry.ts`) and from the client that assembles
 *   the request (`http-client.ts`). Kept apart because this is where every mapping from
 *   an infrastructure failure to a domain failure lives (rule 6.2.4), and that mapping
 *   is worth reading in one screen.
 *
 * The four outcomes
 *   1. `fetch` rejected  -> `aborted`, `timeout`, or `network`, decided by the deadline.
 *   2. non-2xx           -> `http`, with the server's envelope if it sent one.
 *   3. 2xx, bad shape    -> `malformed`, naming the field.
 *   4. 2xx, good shape   -> the decoded value.
 *
 * Why the body is always read as text first
 *   `response.json()` throws on an empty body, and `204 No Content` and a `504` from a
 *   proxy both have one. Reading text and parsing it ourselves means an empty body is
 *   `undefined` — a value the error mapper handles — rather than an exception thrown
 *   from inside the success path.
 *
 * Dependencies
 *   The error vocabulary, the envelope reader, the decoders, and the deadline.
 */

import { abortedError, malformedResponseError, networkError, timeoutError } from './api-error';
import { apiFailure, type ApiResult } from './api-result';
import { toHttpError } from './error-envelope';
import type { Decoder } from './json-shape';
import { startRequestDeadline, type RequestDeadline } from './request-timeout';
import type { TimerApi } from '../stream/idle-watchdog';

/**
 * The `fetch` this client calls.
 *
 * Narrower than `typeof fetch` on purpose: the client only ever passes a string URL, and
 * a narrower type is far easier to satisfy with a test double. The global `fetch` is
 * assignable to it.
 */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Everything needed to send one request once. */
export interface RequestAttemptContext {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  /** Serialised request body, or `undefined` for a bodyless method. */
  readonly body: string | undefined;
  readonly timeoutMs: number;
  readonly signal: AbortSignal | undefined;
  readonly fetchImpl: FetchLike;
  readonly timers: TimerApi | undefined;
}

/** Build the `RequestInit`, omitting `body` entirely rather than setting it undefined. */
function buildInit(context: RequestAttemptContext, signal: AbortSignal): RequestInit {
  const init: RequestInit = { method: context.method, headers: { ...context.headers }, signal };
  return context.body === undefined ? init : { ...init, body: context.body };
}

/**
 * Decide which failure a rejected `fetch` was.
 *
 * The deadline knows, and nothing else does: `fetch` rejects with the same opaque
 * `AbortError` whether the caller cancelled or the budget elapsed.
 */
function classifyFetchRejection(
  deadline: RequestDeadline,
  timeoutMs: number,
  cause: unknown,
): ApiResult<never> {
  if (deadline.wasCancelled()) return apiFailure(abortedError());
  if (deadline.hasTimedOut()) return apiFailure(timeoutError(timeoutMs));
  return apiFailure(networkError(cause));
}

/**
 * Read the body as JSON, tolerating an empty or non-JSON one.
 *
 * @param response - The response to drain. Always drained, so the connection is freed
 *                   even on the error path (rule 6.6.1).
 * @returns The parsed body, or `undefined` when there was nothing parseable.
 *          Side effects: consumes the response body.
 */
async function readJsonBody(response: Response): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch (cause) {
    // A body that fails mid-read leaves nothing to decode. The status is still good
    // information, and the caller's mapper handles an absent body.
    void cause;
    return undefined;
  }

  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    void cause;
    return undefined;
  }
}

/**
 * Send the request once and turn the outcome into a result.
 *
 * @param context - Everything about this attempt.
 * @param decode - Applied to a 2xx body.
 * @returns The decoded value, or exactly one typed failure. Never throws, never
 *          rejects. Side effects: one network request; one timer, always released.
 */
export async function performRequestAttempt<TValue>(
  context: RequestAttemptContext,
  decode: Decoder<TValue>,
): Promise<ApiResult<TValue>> {
  const deadline = startRequestDeadline(context.timeoutMs, context.signal, context.timers);

  try {
    const response = await context.fetchImpl(context.url, buildInit(context, deadline.signal));
    const body = await readJsonBody(response);

    if (!response.ok) return apiFailure(toHttpError(response.status, body));

    const decoded = decode(body, '');
    if (decoded.ok) return decoded;
    return apiFailure(malformedResponseError(decoded.error.path, decoded.error.expected));
  } catch (cause) {
    return classifyFetchRejection(deadline, context.timeoutMs, cause);
  } finally {
    deadline.release();
  }
}
