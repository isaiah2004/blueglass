/**
 * Tests for base-URL resolution and the error-result helpers.
 *
 * What these prove
 *   - An unset or blank `EXPO_PUBLIC_API_URL` falls back to the local API port rather
 *     than producing the URL `undefined/books`.
 *   - Trailing slashes never survive into a joined path.
 *   - A 404 can be reinterpreted as an empty state without special-casing it inside an
 *     endpoint — the behaviour `GET /study/{book}/{chapter}` needs, and the one the
 *     prototype already had (`content_api.dart:69`).
 */

import { describe, expect, it } from 'vitest';

import { httpError, networkError, timeoutError } from './api-error';
import { apiFailure, apiSuccess, describeApiError, emptyOnStatus } from './api-result';
import { FALLBACK_API_BASE_URL, normaliseBaseUrl, resolveApiBaseUrl } from './api-config';

describe('resolveApiBaseUrl', () => {
  it('uses the configured URL', () => {
    expect(resolveApiBaseUrl('http://10.0.2.2:8010')).toBe('http://10.0.2.2:8010');
  });

  it('falls back when unset, empty, or whitespace', () => {
    expect(resolveApiBaseUrl(undefined)).toBe(FALLBACK_API_BASE_URL);
    expect(resolveApiBaseUrl('')).toBe(FALLBACK_API_BASE_URL);
    expect(resolveApiBaseUrl('   ')).toBe(FALLBACK_API_BASE_URL);
  });

  it('strips trailing slashes so a joined path never doubles them', () => {
    expect(resolveApiBaseUrl('http://api.test///')).toBe('http://api.test');
    expect(normaliseBaseUrl('http://api.test/')).toBe('http://api.test');
  });
});

describe('emptyOnStatus', () => {
  it('passes a success through untouched', () => {
    expect(emptyOnStatus(apiSuccess('content'))).toEqual(apiSuccess('content'));
  });

  it('turns the named status into a success carrying null', () => {
    const notFound = apiFailure(httpError({ status: 404, code: 'study_not_found', message: 'no' }));

    expect(emptyOnStatus(notFound)).toEqual(apiSuccess(null));
  });

  it('leaves every other failure alone', () => {
    const unavailable = apiFailure(
      httpError({ status: 503, code: 'dependency_unavailable', message: 'db' }),
    );

    expect(emptyOnStatus(unavailable)).toBe(unavailable);
    expect(emptyOnStatus(apiFailure(timeoutError(10)))).toMatchObject({ ok: false });
  });
});

describe('describeApiError', () => {
  it('gives every kind a secret-free one-liner', () => {
    expect(describeApiError(timeoutError(9_000, 3))).toBe('timeout after 9000ms (3 attempts)');
    expect(describeApiError(networkError(new Error('x'), 2))).toBe('network failure (2 attempts)');
    expect(
      describeApiError(httpError({ status: 404, code: 'chapter_not_found', message: 'no' })),
    ).toBe('HTTP 404 chapter_not_found');
  });
});
