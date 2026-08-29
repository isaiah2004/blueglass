/**
 * Tests for reading the server's error envelope.
 *
 * What these prove
 *   - A real envelope becomes a fully-populated typed failure.
 *   - Every way a body can fail to be an envelope still produces one — the status is
 *     never lost, because it is the one thing the caller genuinely needs.
 *   - Nothing from an untrusted body reaches the reader-facing message unless the body
 *     really was our server's envelope.
 */

import { describe, expect, it } from 'vitest';

import { toHttpError, UNKNOWN_ERROR_CODE } from './error-envelope';

describe('toHttpError', () => {
  it('reads a complete envelope', () => {
    const error = toHttpError(422, {
      error: {
        code: 'chapter_out_of_range',
        message: 'Obadiah has 1 chapter.',
        details: { max: 1 },
        request_id: '8f2c',
      },
    });

    expect(error).toMatchObject({
      kind: 'http',
      status: 422,
      code: 'chapter_out_of_range',
      message: 'Obadiah has 1 chapter.',
      details: { max: 1 },
      requestId: '8f2c',
    });
  });

  it('tolerates an envelope with no details and no request id', () => {
    const error = toHttpError(404, { error: { code: 'book_not_found', message: 'Unknown book.' } });

    expect(error.details).toEqual({});
    expect(error.requestId).toBeNull();
  });

  it('falls back when the body is not an envelope', () => {
    for (const body of [undefined, null, 'gateway timeout', [], { detail: 'nope' }, { error: 1 }]) {
      expect(toHttpError(502, body).code).toBe(UNKNOWN_ERROR_CODE);
    }
  });

  it('never shows a foreign body as the message', () => {
    const error = toHttpError(502, '<html><body>Captive portal</body></html>');

    expect(error.message).not.toContain('Captive portal');
    expect(error.message).toBe('The server had a problem. Try again.');
  });

  it('phrases the fallback for the status', () => {
    expect(toHttpError(401, undefined).message).toContain('not allowed');
    expect(toHttpError(404, undefined).message).toBe('That is not here.');
    expect(toHttpError(429, undefined).message).toContain('Too many requests');
    expect(toHttpError(418, undefined).message).toBe('The request was refused.');
  });

  it('derives retryability from the status, not from the envelope', () => {
    const refused = toHttpError(404, { error: { code: 'book_not_found', message: 'no' } });
    const unavailable = toHttpError(503, {
      error: { code: 'dependency_unavailable', message: 'no' },
    });

    expect(refused.isRetryable).toBe(false);
    expect(unavailable.isRetryable).toBe(true);
  });
});
