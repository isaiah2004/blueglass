/**
 * Tests for the HTTP client's happy path and its response mapping.
 *
 * What these prove
 *   - A 2xx body is decoded into the typed value.
 *   - The identity headers the provider returns are on every request.
 *   - The URL is built from the base, the path and the query, with encoding.
 *   - Every documented failure shape comes back typed — never thrown, never a string.
 *
 * The timing failures — deadline, backoff, cancellation — are in
 * `http-client.failures.test.ts`, because they need a manual clock and this file does
 * not.
 */

import { describe, expect, it } from 'vitest';

import type { ApiError } from './api-error';
import { createHttpClient, type HeaderProvider } from './http-client';
import { createRecordingFetch } from './http-test-doubles';
import { decodeNumber, decodeObject, decodeString } from './json-shape';

/** A stand-in for one of the real endpoint decoders. */
const decodeVerse = decodeObject<{ verse: number; text: string }>({
  verse: decodeNumber,
  text: decodeString,
});

/** The device-id header, as `src/api/identity` would supply it. */
const stubIdentity: HeaderProvider = () =>
  Promise.resolve({ 'X-Atlas-Device-Id': 'atlas-0123456789abcdef' });

/** Read the failure arm without a cast at every assertion. */
function failureOf(result: unknown): ApiError {
  return (result as { error: ApiError }).error;
}

describe('createHttpClient', () => {
  it('decodes a 2xx body into the typed value', async () => {
    const { fetchImpl } = createRecordingFetch([
      { status: 200, body: { verse: 1, text: 'In the beginning' } },
    ]);
    const client = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

    const result = await client.request({ path: '/verses/1', decode: decodeVerse });

    expect(result).toEqual({ ok: true, value: { verse: 1, text: 'In the beginning' } });
  });

  it('sends the identity headers on every request', async () => {
    const { fetchImpl, calls } = createRecordingFetch([{ status: 200, body: { verse: 1, text: 'x' } }]);
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      headers: stubIdentity,
    });

    await client.request({ path: '/verses/1', decode: decodeVerse });

    expect(calls[0]?.init.headers).toMatchObject({
      Accept: 'application/json',
      'X-Atlas-Device-Id': 'atlas-0123456789abcdef',
    });
  });

  it('builds the URL from base, path and query, encoding each', async () => {
    const { fetchImpl, calls } = createRecordingFetch([{ status: 200, body: { verse: 1, text: 'x' } }]);
    const client = createHttpClient({ baseUrl: 'http://api.test/', fetchImpl });

    await client.request({
      path: '/chapters/BSB/Song of Solomon/2',
      query: { q: 'my beloved', limit: 5, scope: undefined },
      decode: decodeVerse,
    });

    expect(calls[0]?.url).toBe(
      'http://api.test/chapters/BSB/Song%20of%20Solomon/2?q=my%20beloved&limit=5',
    );
  });

  it('maps the server error envelope onto a typed http failure', async () => {
    const { fetchImpl } = createRecordingFetch([
      {
        status: 404,
        body: {
          error: {
            code: 'chapter_not_found',
            message: 'No verses for Obadiah 2.',
            details: { book: 'Obad' },
            request_id: '8f2c',
          },
        },
      },
    ]);
    const client = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

    const result = await client.request({ path: '/chapters/BSB/Obad/2', decode: decodeVerse });

    expect(result.ok).toBe(false);
    expect(failureOf(result)).toMatchObject({
      kind: 'http',
      status: 404,
      code: 'chapter_not_found',
      message: 'No verses for Obadiah 2.',
      details: { book: 'Obad' },
      requestId: '8f2c',
      isRetryable: false,
    });
  });

  it('still produces a typed failure when the body is not the envelope', async () => {
    const { fetchImpl } = createRecordingFetch([{ status: 502, body: '<html>gateway</html>' }]);
    const client = createHttpClient({ baseUrl: 'http://api.test', fetchImpl, policy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 } });

    const result = await client.request({ path: '/books', decode: decodeVerse });

    expect(failureOf(result)).toMatchObject({ kind: 'http', status: 502, code: 'http_error' });
    // The proxy's HTML never becomes the message shown to a reader.
    expect(failureOf(result).message).not.toContain('html');
  });

  it('reports a 2xx body that does not match the contract, naming the field', async () => {
    const { fetchImpl } = createRecordingFetch([{ status: 200, body: { verse: '1', text: 'x' } }]);
    const client = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

    const result = await client.request({ path: '/verses/1', decode: decodeVerse });

    expect(failureOf(result)).toMatchObject({
      kind: 'malformed',
      path: 'verse',
      expected: 'a number',
      isRetryable: false,
    });
  });

  it('treats a connection failure as a retryable network error', async () => {
    const { fetchImpl } = createRecordingFetch([
      { status: 0, rejectWith: new TypeError('Failed to fetch') },
    ]);
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      policy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 },
    });

    const result = await client.request({ path: '/health', decode: decodeVerse });

    expect(failureOf(result)).toMatchObject({ kind: 'network', isRetryable: true });
  });

  it('sends a JSON body and declares its content type', async () => {
    const { fetchImpl, calls } = createRecordingFetch([{ status: 200, body: { verse: 1, text: 'x' } }]);
    const client = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

    await client.request({
      path: '/me/prefs',
      method: 'PUT',
      body: { prefs: { rag: true } },
      decode: decodeVerse,
    });

    expect(calls[0]?.init.method).toBe('PUT');
    expect(calls[0]?.init.body).toBe('{"prefs":{"rag":true}}');
    expect(calls[0]?.init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('never throws — every documented failure comes back as a result', async () => {
    const { fetchImpl } = createRecordingFetch([{ status: 500, body: 'not json at all' }]);
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      policy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 },
    });

    await expect(client.request({ path: '/books', decode: decodeVerse })).resolves.toMatchObject({
      ok: false,
    });
  });
});
