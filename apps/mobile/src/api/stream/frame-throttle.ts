/**
 * One-commit-per-frame throttle.
 *
 * Purpose
 *   `docs/architecture/flutter-port-map.md` risk #2: the Flutter app calls
 *   `notifyListeners()` on every SSE delta and rebuilds its whole shell. A fast model
 *   emits 40-80 deltas a second; React cannot re-render a Markdown tree that often. This
 *   is the coalescer — no matter how many deltas land inside one frame, exactly one state
 *   commit comes out of it.
 *
 * Key responsibilities
 *   - Collapse any number of `schedule()` calls in a frame into a single `run()`.
 *   - Let the caller drop or force the pending frame at end of stream.
 *   - Take its scheduler by injection, so tests are deterministic and the module carries
 *     no dependency on `requestAnimationFrame` existing.
 *
 * Why a frame and not a fixed interval
 *   A commit that lands between frames is work the user never sees. Aligning to the frame
 *   is the cheapest schedule that is still visually continuous, and it degrades correctly:
 *   when the JS thread is busy, frames arrive less often and deltas coalesce harder, which
 *   is exactly the behaviour wanted under load.
 */

/** The scheduling primitive. Injectable so tests can step frames by hand. */
export interface FrameScheduler {
  /** Run `callback` on the next frame. Returns a handle for {@link FrameScheduler.cancel}. */
  request(callback: () => void): number;
  /** Cancel a previously requested callback. Must tolerate an already-fired handle. */
  cancel(handle: number): void;
}

/** A coalescing scheduler around one callback. */
export interface FrameThrottle {
  /** Ask for a run on the next frame. Repeated calls before that frame do nothing extra. */
  schedule(): void;
  /** Run now if a frame is pending, cancelling it. No-op when nothing is pending. */
  flush(): void;
  /** Drop a pending frame without running. */
  cancel(): void;
  /** True between a `schedule()` and the frame that services it. */
  readonly isPending: boolean;
}

/** Fallback cadence when no animation frame exists (roughly 60 Hz). */
const FRAME_MS = 16;

/** Resolved once: a runtime either has animation frames or it does not. */
const HAS_ANIMATION_FRAMES = typeof globalThis.requestAnimationFrame === 'function';

/**
 * The platform scheduler: `requestAnimationFrame` on React Native and the browser,
 * a 16 ms timer under the Node test runner and anywhere else without a display loop.
 */
export const defaultFrameScheduler: FrameScheduler = {
  request(callback: () => void): number {
    if (HAS_ANIMATION_FRAMES) {
      return globalThis.requestAnimationFrame(() => {
        callback();
      });
    }
    return globalThis.setTimeout(callback, FRAME_MS);
  },
  cancel(handle: number): void {
    if (HAS_ANIMATION_FRAMES) {
      globalThis.cancelAnimationFrame(handle);
      return;
    }
    globalThis.clearTimeout(handle);
  },
};

/**
 * Create a throttle around `run`.
 *
 * @param run       Called at most once per frame, on the frame following the first
 *                  `schedule()`. Must be cheap and must not throw.
 * @param scheduler How frames are obtained. Defaults to {@link defaultFrameScheduler}.
 * @returns The throttle handle.
 *
 * @example
 * ```ts
 * const throttle = createFrameThrottle(commit);
 * for (const delta of deltas) { buffer += delta; throttle.schedule(); }
 * // `commit` has run once, not `deltas.length` times.
 * ```
 */
export function createFrameThrottle(
  run: () => void,
  scheduler: FrameScheduler = defaultFrameScheduler,
): FrameThrottle {
  let handle: number | null = null;

  const fire = (): void => {
    handle = null;
    run();
  };

  return {
    schedule(): void {
      if (handle !== null) return;
      handle = scheduler.request(fire);
    },
    flush(): void {
      if (handle === null) return;
      scheduler.cancel(handle);
      handle = null;
      run();
    },
    cancel(): void {
      if (handle === null) return;
      scheduler.cancel(handle);
      handle = null;
    },
    get isPending(): boolean {
      return handle !== null;
    },
  };
}
