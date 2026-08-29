/**
 * The query cache's configuration — and the four defaults that matter most.
 *
 * Purpose
 *   Decision `O-01` is "scripture and enrichment work offline; AI and audio need a
 *   connection". Almost all of the offline half is bought here, in a handful of options,
 *   rather than in a synchronisation engine: scripture is immutable, so a chapter that
 *   has been read once never needs fetching again.
 *
 * The four decisions, and why each is what it is
 *
 *   1. **`retry: false`.** The retry is not missing — it happened one layer down, with
 *      exponential backoff and jitter, in `src/api/client/retry.ts`. Leaving TanStack's
 *      own retry on as well would multiply the two: three HTTP attempts inside three
 *      query attempts is nine requests for one failed read, arriving in an unjittered
 *      rhythm the client layer worked to avoid. One retry policy, in the layer that
 *      knows the status codes.
 *
 *   2. **`networkMode: 'offlineFirst'`.** The default (`'online'`) pauses a query when
 *      the browser reports offline, so a cached chapter would render a spinner on a
 *      train. `'offlineFirst'` runs the `queryFn` regardless: a cache hit answers
 *      instantly, and a genuine miss fails fast into the offline state.
 *
 *   3. **`staleTime` of an hour, `gcTime` of a week.** Two different clocks that are
 *      routinely confused. `staleTime` is how long a value is served without a
 *      background refetch; `gcTime` is how long an *unused* value stays in memory at
 *      all — and, because the persister writes whatever is in the cache, how long it
 *      survives a relaunch. A week of `gcTime` is what makes yesterday's chapter open
 *      instantly today. Per-query overrides sharpen both: the canon never changes,
 *      search results are cheap to redo.
 *
 *   4. **`refetchOnWindowFocus: false`.** Pillar 1 is a pristine reading canvas.
 *      Re-fetching the open chapter every time the reader alt-tabs back would be a
 *      network round trip in exchange for a chance to reflow the text they were
 *      reading.
 *
 * Dependencies
 *   `@tanstack/react-query`. No React components, so this module is testable in Node.
 */

import { QueryClient } from '@tanstack/react-query';

/** One minute, in milliseconds. Every duration below is written in terms of it. */
const MINUTE_MS = 60_000;

/** How long a value is served before a background refetch is considered. */
export const DEFAULT_STALE_TIME_MS = 60 * MINUTE_MS;

/** How long an unused value survives — in memory, and therefore in the persisted cache. */
export const DEFAULT_GC_TIME_MS = 7 * 24 * 60 * MINUTE_MS;

/** Scripture text and the canon do not change. Refetching them is pure waste. */
export const IMMUTABLE_STALE_TIME_MS = 24 * 60 * MINUTE_MS;

/** Search results are cheap to redo and go stale as the reader changes their mind. */
export const SEARCH_STALE_TIME_MS = 5 * MINUTE_MS;

/** Liveness is worthless when cached. */
export const HEALTH_STALE_TIME_MS = 30_000;

/**
 * Build the app's query client.
 *
 * @returns A configured client. Create exactly one per app; a second would be a second
 *          cache, and the persister would then race two of them onto one storage key.
 *          Side effects: none until a query runs.
 */
export function createAtlasQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        networkMode: 'offlineFirst',
        staleTime: DEFAULT_STALE_TIME_MS,
        gcTime: DEFAULT_GC_TIME_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
        networkMode: 'offlineFirst',
      },
    },
  });
}
