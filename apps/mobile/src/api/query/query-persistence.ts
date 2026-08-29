/**
 * Write the query cache to storage, and read it back at launch.
 *
 * Purpose
 *   The other half of decision `O-01`. `query-client.ts` keeps a chapter in memory for a
 *   week; this module makes that week survive the process. A reader who read John 3 on
 *   the train yesterday opens it today with no spinner and no network — which is also
 *   what pillar 4 needs, because a five-minute habit loop cannot start with a cold fetch
 *   on a bad connection.
 *
 * This module decides *when*; `cache-snapshot.ts` decides *what*
 *   The format, the version wrapper and the two read/write operations live next door.
 *   What is left here is scheduling, which is the part with a subtle failure mode.
 *
 * Write cost, and the throttle
 *   Dehydrating serialises the whole cache, so it must not happen once per cache event
 *   during a scroll. A change schedules one write; everything that happens inside the
 *   window folds into it. Same shape as the streaming draft store's frame throttle, and
 *   the same reason.
 *
 * Why this is hand-written rather than `@tanstack/react-query-persist-client`
 *   That package would do this, and it is not installed. What it adds over the code below
 *   is a React provider that gates rendering on restoration — behaviour this app
 *   specifically does not want, because the reader should see the shell immediately and
 *   the text as soon as either source produces it. Writing it here also keeps the storage
 *   engine behind `KeyValueStore`, so the persisted cache works on web without a second
 *   adapter.
 *
 * Dependencies
 *   `@tanstack/react-query`, the storage contract, and the shared `TimerApi`.
 */

import type { QueryClient } from '@tanstack/react-query';

import { deviceKeyValueStore, QUERY_CACHE_STORAGE_KEY, type KeyValueStore } from '../storage';
import { defaultTimerApi, type TimerApi } from '../stream/idle-watchdog';
import { readSnapshot, writeSnapshot } from './cache-snapshot';

export { PERSISTED_CACHE_VERSION } from './cache-snapshot';

/** Default gap between a cache change and the write it causes. */
export const DEFAULT_PERSIST_THROTTLE_MS = 1_000;

/** Default age past which a whole snapshot is discarded rather than hydrated. */
export const DEFAULT_PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

/** Construction options. Every one has a working default. */
export interface QueryCachePersisterOptions {
  readonly queryClient: QueryClient;
  readonly store?: KeyValueStore;
  readonly storageKey?: string;
  readonly maxAgeMs?: number;
  readonly throttleMs?: number;
  readonly timers?: TimerApi;
  /** Clock, for tests that need to age a snapshot without waiting a week. */
  readonly now?: () => number;
}

/** The persister's surface. */
export interface QueryCachePersister {
  /** Hydrate from storage. Call once, before or during the first render. */
  restore(): Promise<boolean>;
  /** Begin persisting on change. @returns The unsubscribe function (rule 6.6.1). */
  start(): () => void;
  /** Write now, skipping the throttle. For backgrounding the app. */
  flush(): Promise<void>;
  /** Delete the snapshot. For "clear cached scripture". */
  clear(): Promise<void>;
}

/** A pending write, and the two things anyone ever does to one. */
interface WriteSchedule {
  /** Ask for a write. A second ask inside the window folds into the first. */
  schedule(): void;
  /** Drop a pending write without performing it. */
  cancel(): void;
}

/**
 * Build the throttle.
 *
 * @param throttleMs - How long to gather changes before writing.
 * @param timers - Timer implementation.
 * @param write - What to run when the window closes.
 * @returns The schedule. It owns the timer, so nothing else may set one.
 */
function createWriteSchedule(
  throttleMs: number,
  timers: TimerApi,
  write: () => Promise<void>,
): WriteSchedule {
  let pending: number | null = null;

  return {
    schedule(): void {
      if (pending !== null) return;
      pending = timers.set(() => {
        pending = null;
        void write();
      }, throttleMs);
    },
    cancel(): void {
      if (pending === null) return;
      timers.clear(pending);
      pending = null;
    },
  };
}

/**
 * Build the persister.
 *
 * @param options - The client to persist, and where to put it.
 * @returns The persister. Nothing is read or written until a method is called.
 */
export function createQueryCachePersister(
  options: QueryCachePersisterOptions,
): QueryCachePersister {
  const {
    queryClient,
    store = deviceKeyValueStore,
    storageKey = QUERY_CACHE_STORAGE_KEY,
    maxAgeMs = DEFAULT_PERSIST_MAX_AGE_MS,
    throttleMs = DEFAULT_PERSIST_THROTTLE_MS,
    timers = defaultTimerApi,
    now = Date.now,
  } = options;

  const write = (): Promise<void> => writeSnapshot(queryClient, store, storageKey, now());
  const schedule = createWriteSchedule(throttleMs, timers, write);

  return {
    restore: () => readSnapshot(queryClient, store, storageKey, maxAgeMs, now),

    start(): () => void {
      // Wrapped rather than passed by reference: an unbound method handed to a
      // subscriber is called with the wrong `this` the moment the implementation stops
      // being a closure.
      const unsubscribe = queryClient.getQueryCache().subscribe(() => {
        schedule.schedule();
      });
      return () => {
        schedule.cancel();
        unsubscribe();
      };
    },

    flush(): Promise<void> {
      schedule.cancel();
      return write();
    },

    clear(): Promise<void> {
      schedule.cancel();
      return store.remove(storageKey);
    },
  };
}
