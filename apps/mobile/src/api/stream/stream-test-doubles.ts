/**
 * Test doubles shared by the streaming tests.
 *
 * Purpose
 *   The client's behaviour is tested from two angles — the happy path in
 *   `chat-stream-client.test.ts`, the failure paths in
 *   `chat-stream-client.failures.test.ts` — and both need the same fake transport and the
 *   same hand-driven timers. Duplicating them across files would let the two copies drift.
 *
 * Key responsibilities
 *   - Replay a fixed SSE transcript as byte chunks through the real transport interface.
 *   - Give tests a timer API and a frame scheduler they step by hand, so nothing sleeps.
 *
 * Not shipped
 *   No application module imports this file, so Metro never bundles it. It lives beside
 *   the code it supports rather than in a `tests/` tree, matching the colocation rule.
 */

import type { FrameScheduler } from './frame-throttle';
import type { TimerApi } from './idle-watchdog';
import type { SseChunk, SseRequest, SseTransport } from './transport';

/** A transport that replays fixed text pieces as byte chunks and records its requests. */
export interface ReplayTransport {
  readonly transport: SseTransport;
  /** Every request the transport was asked to open, in order. */
  readonly requests: SseRequest[];
}

/**
 * Build a transport that emits `pieces` as byte chunks and then completes.
 *
 * @param pieces Raw SSE text, split wherever the test wants the chunk boundaries.
 * @returns The transport plus the list it records requests into.
 */
export function replayTransport(pieces: readonly string[]): ReplayTransport {
  const requests: SseRequest[] = [];
  const encoder = new TextEncoder();
  return {
    requests,
    transport: {
      id: 'streaming-fetch',
      stream(request: SseRequest, onChunk: (chunk: SseChunk) => void): Promise<void> {
        requests.push(request);
        for (const piece of pieces) {
          onChunk({ encoding: 'bytes', bytes: encoder.encode(piece) });
        }
        return Promise.resolve();
      },
    },
  };
}

/** A timer API whose callbacks only run when the test says so. */
export interface ManualTimers {
  readonly timers: TimerApi;
  /** How many timers are armed right now. */
  pending(): number;
  /** Run every armed timer. */
  fire(): void;
}

/**
 * Build hand-driven timers.
 *
 * @returns The timer API to inject, plus the controls to step it.
 */
export function createManualTimers(): ManualTimers {
  const queued = new Map<number, () => void>();
  let nextHandle = 1;
  return {
    timers: {
      set(callback: () => void): number {
        const handle = nextHandle;
        nextHandle += 1;
        queued.set(handle, callback);
        return handle;
      },
      clear(handle: number): void {
        queued.delete(handle);
      },
    },
    pending: () => queued.size,
    fire: (): void => {
      const due = [...queued.values()];
      queued.clear();
      for (const callback of due) callback();
    },
  };
}

/** A frame scheduler whose frames only happen when the test says so. */
export interface ManualScheduler {
  readonly scheduler: FrameScheduler;
  /** How many frames have ever been requested. */
  requestCount(): number;
  /** How many frames are armed right now. */
  pendingCount(): number;
  /** Service every armed frame. */
  tick(): void;
}

/**
 * Build a hand-driven frame scheduler.
 *
 * @returns The scheduler to inject, plus the controls to step it.
 */
export function createManualScheduler(): ManualScheduler {
  const queued = new Map<number, () => void>();
  let nextHandle = 1;
  let requests = 0;
  return {
    scheduler: {
      request(callback: () => void): number {
        requests += 1;
        const handle = nextHandle;
        nextHandle += 1;
        queued.set(handle, callback);
        return handle;
      },
      cancel(handle: number): void {
        queued.delete(handle);
      },
    },
    requestCount: () => requests,
    pendingCount: () => queued.size,
    tick: (): void => {
      const due = [...queued.values()];
      queued.clear();
      for (const callback of due) callback();
    },
  };
}
