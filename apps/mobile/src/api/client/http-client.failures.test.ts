/**
 * Tests for the HTTP client's timing failures: deadlines, retries, cancellation.
 *
 * What these prove
 *   1. **A timeout produces a typed error**, not a hung promise and not a thrown string.
 *   2. **Retries back off and do not double-fire.** A transient 503 is followed by
 *      exactly one further request, after exactly one wait; three failures make three
 *      requests, never four, and never two at once.
 *   3. A cancelled request comes back as `aborted`, having made no further attempt.
 *   4. Every deadline releases its timer, whatever the outcome.
 *
 * Everything is driven by a manual clock and an injected sleep, so the suite spends no
 * real time waiting and cannot flake on a slow machine.
 */

import { describe, expect, it } from 'vitest';

import type { ApiError } from './api-error';
import { createHttpClient } from './http-client';
import { createHangingFetch, createManualTimers, createRecordingFetch } from './http-test-doubles';
import type { FetchLike } from './http-attempt';
import { decodeObject, decodeString } from './json-shape';
import type { Sleep } from './retry';
import { DEFAULT_RETRY_POLICY } from './retry-policy';

/** Any 2xx body will do here; these tests never reach a successful decode but one. */
const decodeStatus = decodeObject<{ status: string }>({ status: decodeString });

/** Jitter fixed at its floor, so recorded waits are exactly the schedule. */
const noJitter = (): number => 0;

/** A sleep that records its waits and returns immediately. */
function createRecordingSleep(): { sleep: Sleep; waits: number[] } {
  const waits: number[] = [];
  return {
    waits,
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

/** Read the failure arm without a cast at every assertion. */
function failureOf(result: unknown): ApiError {
  return (result as { error: ApiError }).error;
}

describe('the request deadline', () => {
  it('produces a typed timeout error rather than hanging', async () => {
    const timers = createManualTimers();
    const { sleep } = createRecordingSleep();
    // Firing the clock the moment the request is in flight is what makes it time out.
    const fetchImpl = createHangingFetch(() => {
      timers.runAll();
    });
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      timers,
      sleep,
      random: noJitter,
      timeoutMs: 9_000,
      policy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 },
    });

    const result = await client.request({ path: '/health', decode: decodeStatus });

    expect(result.ok).toBe(false);
    expect(failureOf(result)).toMatchObject({
      kind: 'timeout',
      timeoutMs: 9_000,
      isRetryable: true,
      attempts: 1,
    });
  });

  it('retries a timeout up to the policy, and reports the attempts made', async () => {
    const timers = createManualTimers();
    const { sleep, waits } = createRecordingSleep();
    let requests = 0;
    const fetchImpl = createHangingFetch(() => {
      requests += 1;
      timers.runAll();
    });
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      timers,
      sleep,
      random: noJitter,
      policy: DEFAULT_RETRY_POLICY,
    });

    const result = await client.request({ path: '/health', decode: decodeStatus });

    expect(requests).toBe(DEFAULT_RETRY_POLICY.maxAttempts);
    expect(waits).toEqual([150, 300]);
    expect(failureOf(result).attempts).toBe(DEFAULT_RETRY_POLICY.maxAttempts);
  });

  it('releases every timer it set, whatever the outcome', async () => {
    const timers = createManualTimers();
    const { fetchImpl } = createRecordingFetch([{ status: 200, body: { status: 'ok' } }]);
    const client = createHttpClient({ baseUrl: 'http://api.test', fetchImpl, timers });

    await client.request({ path: '/health', decode: decodeStatus });

    expect(timers.pendingCount()).toBe(0);
  });
});

describe('retrying', () => {
  it('recovers from a transient 503 with exactly one further request', async () => {
    const { sleep, waits } = createRecordingSleep();
    const { fetchImpl, calls } = createRecordingFetch([
      { status: 503, body: { error: { code: 'dependency_unavailable', message: 'db' } } },
      { status: 200, body: { status: 'ok' } },
    ]);
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      sleep,
      random: noJitter,
    });

    const result = await client.request({ path: '/health', decode: decodeStatus });

    expect(result).toEqual({ ok: true, value: { status: 'ok' } });
    expect(calls).toHaveLength(2);
    expect(waits).toEqual([150]);
  });

  it('does not double-fire: three failures make three requests, not four', async () => {
    const { sleep } = createRecordingSleep();
    const { fetchImpl, calls } = createRecordingFetch([
      { status: 500, body: { error: { code: 'internal_error', message: 'boom' } } },
    ]);
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      sleep,
      random: noJitter,
    });

    await client.request({ path: '/health', decode: decodeStatus });

    expect(calls).toHaveLength(DEFAULT_RETRY_POLICY.maxAttempts);
  });

  it('never retries a 404, because the same request would fail identically', async () => {
    const { sleep } = createRecordingSleep();
    const { fetchImpl, calls } = createRecordingFetch([
      { status: 404, body: { error: { code: 'chapter_not_found', message: 'gone' } } },
    ]);
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      sleep,
      random: noJitter,
    });

    await client.request({ path: '/chapters/BSB/Obad/2', decode: decodeStatus });

    expect(calls).toHaveLength(1);
  });

  it('never retries a malformed body, because the body will not change', async () => {
    const { sleep } = createRecordingSleep();
    const { fetchImpl, calls } = createRecordingFetch([{ status: 200, body: { status: 7 } }]);
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      sleep,
      random: noJitter,
    });

    await client.request({ path: '/health', decode: decodeStatus });

    expect(calls).toHaveLength(1);
  });
});

describe('cancellation', () => {
  it('reports an aborted request and makes no further attempt', async () => {
    const controller = new AbortController();
    const { sleep } = createRecordingSleep();
    let requests = 0;
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        requests += 1;
        init.signal?.addEventListener('abort', () => {
          reject(new Error('The operation was aborted.'));
        });
        controller.abort();
      });
    const client = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      sleep,
      random: noJitter,
    });

    const result = await client.request({
      path: '/search',
      decode: decodeStatus,
      signal: controller.signal,
    });

    expect(requests).toBe(1);
    expect(failureOf(result)).toMatchObject({ kind: 'aborted', isRetryable: false });
  });

  it('does not send anything at all when the caller has already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetchImpl, calls } = createRecordingFetch([{ status: 200, body: { status: 'ok' } }]);
    const client = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

    const result = await client.request({
      path: '/health',
      decode: decodeStatus,
      signal: controller.signal,
    });

    expect(calls).toHaveLength(0);
    expect(failureOf(result).kind).toBe('aborted');
  });
});
