/**
 * Idle watchdog for a long-lived stream.
 *
 * Purpose
 *   Rule 6.4.1 forbids indefinite waits on an external service, but a *total* timeout is
 *   the wrong shape for a chat stream: a long grounded answer can legitimately take
 *   minutes. What is never legitimate is a socket that is open and silent. This measures
 *   the gap between chunks and fires when one gets too long.
 *
 * Key responsibilities
 *   - Fire `onIdle` when `timeoutMs` passes with no `touch()`.
 *   - Restart the clock on every chunk, cheaply — one `clear` and one `set` per chunk.
 *   - Take its timer API by injection so tests need no fake clock.
 */

/** The timer primitives, injectable for tests. */
export interface TimerApi {
  set(callback: () => void, ms: number): number;
  clear(handle: number): void;
}

/** The platform timers. */
export const defaultTimerApi: TimerApi = {
  set: (callback: () => void, ms: number): number => globalThis.setTimeout(callback, ms),
  clear: (handle: number): void => {
    globalThis.clearTimeout(handle);
  },
};

/** A restartable silence detector. */
export interface IdleWatchdog {
  /** Start (or restart) the clock. */
  touch(): void;
  /** Stop for good. Safe to call more than once and safe to call before `touch`. */
  stop(): void;
}

/**
 * Create a watchdog.
 *
 * @param timeoutMs Milliseconds of silence tolerated. `0` or less disables the watchdog
 *                  entirely, which is the documented way to opt out.
 * @param onIdle    Called once when the budget is exceeded. Never called after `stop()`.
 * @param timers    Timer implementation. Defaults to {@link defaultTimerApi}.
 * @returns The watchdog. It is not running until the first `touch()`.
 */
export function createIdleWatchdog(
  timeoutMs: number,
  onIdle: () => void,
  timers: TimerApi = defaultTimerApi,
): IdleWatchdog {
  let handle: number | null = null;
  let stopped = false;

  const clear = (): void => {
    if (handle === null) return;
    timers.clear(handle);
    handle = null;
  };

  return {
    touch(): void {
      if (stopped || timeoutMs <= 0) return;
      clear();
      handle = timers.set(() => {
        handle = null;
        onIdle();
      }, timeoutMs);
    },
    stop(): void {
      stopped = true;
      clear();
    },
  };
}
