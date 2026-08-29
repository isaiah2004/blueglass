/**
 * Formatting a `[Meditate]` payload's timing.
 *
 * Purpose
 *   `suggestedDurationSeconds` and `breathCycleSeconds` exist to prove the daily habit
 *   loop's "reflect" step fits inside five minutes (`literary-badge.types.ts`). This turns
 *   both into the short caption `MeditateSheet`'s duration section shows.
 *
 * Dependencies
 *   None. Pure — no React.
 */

/**
 * The duration caption, e.g. `About 3 minutes` or `About 90 seconds`.
 *
 * @param seconds - The suggested pause length.
 * @returns The caption. Side effects: none.
 */
export function durationCaption(seconds: number): string {
  if (seconds < 60) {
    return `About ${String(seconds)} seconds`;
  }

  const minutes = Math.round(seconds / 60);

  return `About ${String(minutes)} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * The breathing-pace caption, when the payload offers one.
 *
 * @param breathCycleSeconds - Length of one guided breath cycle.
 * @returns The caption, e.g. `One breath every 6 seconds`. Side effects: none.
 */
export function breathCycleCaption(breathCycleSeconds: number): string {
  return `One breath every ${String(breathCycleSeconds)} seconds`;
}
