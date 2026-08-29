/**
 * Give one request a deadline, and keep it cancellable by its caller.
 *
 * Purpose
 *   Rule 6.4.1: no call to an external service waits indefinitely. A request also has
 *   to stay cancellable — the reader typed another letter, or left the chapter — so two
 *   independent reasons to abort must drive one signal.
 *
 * Why not `AbortSignal.any`
 *   It would do exactly this in one line, and it is not dependable here: Hermes lags the
 *   web platform, and a helper that works on web and throws on device is worse than no
 *   helper. Linking by hand is a dozen lines and works everywhere the app runs.
 *
 * Why the reason is tracked as a flag rather than read from `signal.reason`
 *   `signal.reason` is only reliably populated when the aborter passes one, and the
 *   caller's controller is not ours to dictate. A local boolean, set at the only place
 *   that can set it, cannot be wrong — and telling a timeout apart from a cancellation
 *   matters: one is a fault the reader should see, the other must render nothing.
 *
 * Dependencies
 *   `../stream/idle-watchdog` for the injectable {@link TimerApi} — the same one the SSE
 *   client uses, so there is one timer seam in the API layer rather than two.
 */

import { defaultTimerApi, type TimerApi } from '../stream/idle-watchdog';

/** A live deadline. Always `release()` it, on every path (rule 6.6.1). */
export interface RequestDeadline {
  /** Pass to `fetch`. Aborts on timeout, on caller cancellation, or on both. */
  readonly signal: AbortSignal;
  /** True when *this* deadline fired, as opposed to the caller cancelling. */
  hasTimedOut(): boolean;
  /** True when the caller's own signal aborted. */
  wasCancelled(): boolean;
  /** Clear the timer and drop the listener. Safe to call more than once. */
  release(): void;
}

/**
 * Start a deadline for one attempt.
 *
 * @param timeoutMs - The budget. `0` or less means no timeout — used only by callers
 *                    that supply their own (the SSE client has an idle watchdog
 *                    instead).
 * @param callerSignal - The caller's cancellation, if any.
 * @param timers - Timer implementation. Tests inject a double.
 * @returns The deadline, already running. Side effects: sets one timer and adds one
 *          `abort` listener to `callerSignal`.
 */
export function startRequestDeadline(
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
  timers: TimerApi = defaultTimerApi,
): RequestDeadline {
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = callerSignal?.aborted === true;
  let handle: number | null = null;

  const onCallerAbort = (): void => {
    cancelled = true;
    controller.abort();
  };

  const release = (): void => {
    if (handle !== null) {
      timers.clear(handle);
      handle = null;
    }
    callerSignal?.removeEventListener('abort', onCallerAbort);
  };

  if (cancelled) {
    controller.abort();
  } else {
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    if (timeoutMs > 0) {
      handle = timers.set(() => {
        handle = null;
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    }
  }

  return {
    signal: controller.signal,
    hasTimedOut: () => timedOut,
    wasCancelled: () => cancelled,
    release,
  };
}
