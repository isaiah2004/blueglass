/**
 * Test doubles for the HTTP client: a manual clock, canned responses, a recording fetch.
 *
 * Purpose
 *   The client's three hardest behaviours — a deadline elapsing, a retry backing off,
 *   and a cancellation arriving mid-flight — are all timing. Testing them against a real
 *   clock would make the suite slow and flaky, so the client takes its timers, its sleep
 *   and its `fetch` by injection and these are what gets injected.
 *
 * Not shipped
 *   Nothing in the app imports this module. It sits beside the code rather than under a
 *   `__tests__` folder for the same reason the tests do (rule 8.5), and it exports no
 *   behaviour the client itself relies on.
 *
 * Dependencies
 *   `../stream/idle-watchdog` for the `TimerApi` shape, and `./http-attempt` for
 *   `FetchLike`.
 */

import type { TimerApi } from '../stream/idle-watchdog';
import type { FetchLike } from './http-attempt';

/** A clock the test advances by hand. */
export interface ManualTimers extends TimerApi {
  /** Fire every scheduled callback that has not been cleared, in order. */
  runAll(): void;
  /** How many callbacks are outstanding. Proves nothing leaked (rule 6.6.1). */
  pendingCount(): number;
}

/**
 * Build a manual clock.
 *
 * @returns Timers whose callbacks only run when `runAll` is called.
 */
export function createManualTimers(): ManualTimers {
  const scheduled = new Map<number, () => void>();
  let nextHandle = 1;

  return {
    set(callback: () => void): number {
      const handle = nextHandle;
      nextHandle += 1;
      scheduled.set(handle, callback);
      return handle;
    },
    clear(handle: number): void {
      scheduled.delete(handle);
    },
    runAll(): void {
      for (const [handle, callback] of [...scheduled]) {
        scheduled.delete(handle);
        callback();
      }
    },
    pendingCount(): number {
      return scheduled.size;
    },
  };
}

/** One canned reply: a status and a body, or an instruction to reject. */
export interface CannedReply {
  readonly status: number;
  /** Serialised as JSON. Pass a string to send it verbatim (for a non-JSON body). */
  readonly body?: unknown;
  /** Reject the request instead of answering, simulating a dead connection. */
  readonly rejectWith?: Error;
}

/** A `fetch` double that records every call and replies from a script. */
export interface RecordingFetch {
  readonly fetchImpl: FetchLike;
  /** Every request made, in order. */
  readonly calls: { url: string; init: RequestInit }[];
}

/** Turn a canned reply into a `Response`. */
function toResponse(reply: CannedReply): Response {
  const body =
    reply.body === undefined
      ? ''
      : typeof reply.body === 'string'
        ? reply.body
        : JSON.stringify(reply.body);
  return new Response(body, {
    status: reply.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Build a recording `fetch`.
 *
 * @param replies - One per expected call. The last is repeated once exhausted, so a
 *                  test that only cares about the first two calls need not list three.
 * @returns The double and its call log.
 */
export function createRecordingFetch(replies: readonly CannedReply[]): RecordingFetch {
  const calls: { url: string; init: RequestInit }[] = [];
  let index = 0;

  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    const reply = replies[Math.min(index, replies.length - 1)];
    index += 1;
    if (reply === undefined) return Promise.reject(new Error('No canned reply.'));
    if (reply.rejectWith !== undefined) return Promise.reject(reply.rejectWith);
    return Promise.resolve(toResponse(reply));
  };

  return { fetchImpl, calls };
}

/**
 * Build a `fetch` that never answers, and rejects when its signal aborts.
 *
 * @param onRequest - Called once the abort listener is attached. A deadline test fires
 *                    the manual clock here, which is the moment that makes the request
 *                    time out.
 * @returns The double.
 */
export function createHangingFetch(onRequest: () => void): FetchLike {
  return (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      const abort = (): void => {
        reject(new Error('The operation was aborted.'));
      };
      if (init.signal?.aborted === true) {
        abort();
        return;
      }
      init.signal?.addEventListener('abort', abort, { once: true });
      onRequest();
    });
}
