/**
 * Read the API's error envelope off a non-2xx response body.
 *
 * Purpose
 *   The server answers every failure with one shape
 *   (`apps/api/app/shared/http/error_envelope.py`):
 *
 *   ```jsonc
 *   { "error": { "code": "chapter_not_found", "message": "…",
 *                "details": { … }, "request_id": "8f2c…" } }
 *   ```
 *
 *   This module turns that into an {@link ApiHttpError}. It is the only place in the
 *   client that knows the envelope's field names, so a change to the contract is one
 *   edit here rather than a search across every endpoint.
 *
 * Why it must never fail
 *   A body arrives from a proxy, a captive-portal login page, a 502 from something that
 *   is not our server at all, or a `504` with an empty body. None of those carry the
 *   envelope, and none of them is a reason to lose the status code — which is the one
 *   piece of information the caller genuinely needs. Every path therefore produces an
 *   `ApiHttpError`; the envelope only makes it more specific.
 *
 * Dependencies
 *   `api-error.ts` and `json-shape.ts`.
 */

import { httpError, type ApiHttpError } from './api-error';
import { decodeRecord, decodeString } from './json-shape';

/** The code used when the body carried no envelope of its own. */
export const UNKNOWN_ERROR_CODE = 'http_error';

/** Fallback text, phrased for a reader rather than for a developer. */
function fallbackMessage(status: number): string {
  if (status === 401 || status === 403) return 'This device is not allowed to do that.';
  if (status === 404) return 'That is not here.';
  if (status === 429) return 'Too many requests. Try again in a moment.';
  if (status >= 500) return 'The server had a problem. Try again.';
  return 'The request was refused.';
}

/** The `error` object, once it has been found and shape-checked. */
interface EnvelopeFields {
  readonly code: string;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly requestId: string | null;
}

/**
 * Pull the envelope's fields out of a parsed body, tolerating every absence.
 *
 * @param body - The parsed response body, or `undefined` when it was not JSON.
 * @returns The fields, or `null` when this body is not an envelope.
 *          Side effects: none.
 */
function readEnvelope(body: unknown): EnvelopeFields | null {
  const root = decodeRecord(body, 'body');
  if (!root.ok) return null;

  const errorObject = decodeRecord(root.value['error'], 'body.error');
  if (!errorObject.ok) return null;

  const code = decodeString(errorObject.value['code'], 'body.error.code');
  const message = decodeString(errorObject.value['message'], 'body.error.message');
  if (!code.ok || !message.ok) return null;

  const details = decodeRecord(errorObject.value['details'], 'body.error.details');
  const requestId = decodeString(errorObject.value['request_id'], 'body.error.request_id');

  return {
    code: code.value,
    message: message.value,
    details: details.ok ? details.value : {},
    requestId: requestId.ok ? requestId.value : null,
  };
}

/**
 * Build the failure for a non-2xx response.
 *
 * @param status - The HTTP status the server returned.
 * @param body - The parsed body, or `undefined` if it did not parse as JSON. The raw
 *               text is deliberately not accepted: an arbitrary body could be an HTML
 *               login page carrying whatever the network injected, and none of it
 *               belongs in a message this app displays.
 * @returns The typed failure. Never throws. Side effects: none.
 */
export function toHttpError(status: number, body: unknown): ApiHttpError {
  const envelope = readEnvelope(body);
  if (envelope === null) {
    return httpError({ status, code: UNKNOWN_ERROR_CODE, message: fallbackMessage(status) });
  }

  return httpError({
    status,
    code: envelope.code,
    message: envelope.message,
    details: envelope.details,
    requestId: envelope.requestId,
  });
}
