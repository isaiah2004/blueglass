/**
 * The frame loop that drives the route line's draw.
 *
 * Purpose
 *   Hold the one piece of state the map animation needs, and hold it in the smallest
 *   possible component. `DECISIONS.md` A-3 records why that matters: the Flutter prototype
 *   notifies per token and re-renders its whole shell, and "Flutter absorbs it; React would
 *   not". A progress value updated sixty times a second is the same hazard, so this hook is
 *   used by `RouteLine` alone — the coastline, the pins and the labels are memoised
 *   siblings and never re-render while the line is drawing.
 *
 * Why the reset happens during render and not in an effect
 *   Restarting the draw is "adjust state when a prop changes", which React documents as a
 *   render-time `setState` on a previous-value guard. Doing it in an effect instead would
 *   paint one frame of the *old* route before resetting, and `react-hooks/set-state-in-effect`
 *   rejects it for exactly that reason. The effect below therefore only ever schedules
 *   frames; the only `setState` it performs is inside the frame callback.
 *
 * Reduced motion
 *   A duration of zero starts at 1 and schedules nothing at all. The component then
 *   cross-fades instead of drawing, which is what `design-language.md` §6 asks for.
 *
 * Dependencies
 *   React, and `./draw-progress` for the arithmetic. `requestAnimationFrame` exists on both
 *   targets: the browser provides it, and React Native polyfills it on its own frame timer.
 */

import { useEffect, useState } from 'react';

import { progressAt } from './draw-progress';

/** What the hook remembers between renders. */
interface DrawState {
  /** The `restartKey` this progress belongs to. */
  readonly key: string;
  /** The duration this progress belongs to. */
  readonly durationMs: number;
  /** How much of the line is drawn, in `[0, 1]`. */
  readonly progress: number;
}

/** The state a fresh draw starts from. */
function initialState(durationMs: number, key: string): DrawState {
  return { key, durationMs, progress: progressAt(0, durationMs) };
}

/**
 * Animate a value from 0 to 1 over `durationMs`.
 *
 * @param durationMs - How long the draw takes. `0` finishes immediately and schedules
 *   nothing.
 * @param restartKey - Changing this restarts the draw from zero. Pass something identifying
 *   what is being drawn — the route's title — so re-opening the sheet on a different
 *   passage re-animates and a re-render for any other reason does not.
 * @returns The current progress, in `[0, 1]`.
 *
 * Side effects: schedules `requestAnimationFrame` callbacks until progress reaches 1, and
 * cancels the pending one on unmount or when either argument changes.
 */
export function useDrawProgress(durationMs: number, restartKey: string): number {
  const [state, setState] = useState<DrawState>(() => initialState(durationMs, restartKey));

  if (state.key !== restartKey || state.durationMs !== durationMs) {
    setState(initialState(durationMs, restartKey));
  }

  useEffect(() => {
    if (durationMs <= 0) return undefined;

    let frame = 0;
    let start: number | null = null;

    const step = (now: number): void => {
      start ??= now;
      const progress = progressAt(now - start, durationMs);
      setState({ key: restartKey, durationMs, progress });
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return (): void => {
      cancelAnimationFrame(frame);
    };
  }, [durationMs, restartKey]);

  return state.progress;
}
