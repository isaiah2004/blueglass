/**
 * A value, but only once it has stopped changing.
 *
 * Purpose
 *   The search box must not spend a round trip per keystroke. Debouncing the *value* rather
 *   than the request keeps the input perfectly responsive — the box renders every character
 *   immediately — while the query key downstream changes at most once per pause.
 *
 * Why not debounce inside the query hook
 *   Because then the cache key would be the raw input and every intermediate string would
 *   still get its own cache entry. Settling first means TanStack only ever sees the queries
 *   a reader actually asked for.
 *
 * Dependencies
 *   React only. No timers leak: the effect clears its own.
 */

import { useEffect, useState } from 'react';

/**
 * The latest value, delayed until it has been still for `delayMs`.
 *
 * @param value - The value to settle.
 * @param delayMs - How long the value must be unchanged before it is reported.
 * @returns The settled value. Starts equal to `value`, so the first render is not delayed.
 *
 * Side effects: schedules and clears one timer per change.
 */
export function useDebouncedValue<TValue>(value: TValue, delayMs: number): TValue {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (Object.is(settled, value)) return undefined;
    const timer = setTimeout(() => {
      setSettled(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs, settled]);

  return settled;
}
