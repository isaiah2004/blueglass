/**
 * The browser implementation of {@link KeyValueStore}, backed by `localStorage`.
 *
 * Purpose
 *   Web is a first-class target (`T-01`), so the persistence layer needs an engine that
 *   exists in a browser. `localStorage` is it: synchronous, origin-scoped, present in
 *   every browser Expo web supports, and — unlike `react-native-mmkv` — requiring no
 *   native module. This file is therefore what the *default* (non-`.native`) resolution
 *   of `device-storage.ts` selects, which also makes it the store the Node test runner
 *   sees.
 *
 * The three ways `localStorage` fails, and what happens
 *   1. **It is absent.** Node, a worker, an SSR pass. `resolveWebStorage` returns null
 *      and the factory falls back to memory.
 *   2. **Access throws.** Safari private mode and a blocked third-party context throw
 *      on the *property access*, before any method call. That is why availability is
 *      probed inside a `try` rather than tested with `in`.
 *   3. **A write throws.** The 5 MB origin quota is exceeded — realistic, because the
 *      dehydrated query cache is the largest thing we store. `setString` resolves
 *      anyway: a cache that could not be persisted is a slower next launch, not a
 *      failure the reader should be shown (rule 6.4.4).
 *
 * Key responsibilities
 *   - Adapt a synchronous, throwing `Storage` to the asynchronous, non-throwing
 *     {@link KeyValueStore} contract.
 *   - Degrade to an in-memory store when no usable `Storage` exists, so that calling
 *     code never branches on the platform.
 *
 * Dependencies
 *   `key-value-store.ts` only. No React, no React Native, no Expo — this module is
 *   loaded by the web bundle and by every unit test.
 */

import { createMemoryKeyValueStore, type KeyValueStore, type StorageKey } from './key-value-store';

/**
 * The slice of the DOM `Storage` interface this module uses.
 *
 * Declared structurally rather than referencing the DOM's `Storage` type, because the
 * Expo client's `tsconfig` sets `"types": []` and the React Native lib does not supply
 * DOM globals. A test also passes its own object here.
 */
export interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `globalThis`, narrowed to the one optional property this module reads. */
interface GlobalWithStorage {
  localStorage?: WebStorageLike;
}

/**
 * Find a usable `localStorage`, proving it by writing.
 *
 * A read-only probe is not enough: Safari's private mode exposes the object and throws
 * only on `setItem`, so a store validated by reading would fail on its first write —
 * after the caller had already been told persistence was available.
 *
 * @returns The browser's `localStorage`, or `null` when it is missing or unusable.
 *          Side effects: writes and removes one probe key.
 */
export function resolveWebStorage(): WebStorageLike | null {
  const candidate = (globalThis as GlobalWithStorage).localStorage;
  if (candidate === undefined) return null;

  const probeKey = 'atlas.storage-probe';
  try {
    candidate.setItem(probeKey, '1');
    candidate.removeItem(probeKey);
    return candidate;
  } catch (cause) {
    // Deliberately swallowed after being turned into a decision, not a log: this is the
    // documented "private browsing" path, it fires on a cold start before any logger
    // exists, and the caller learns the outcome from `store.kind === 'memory'`.
    void cause;
    return null;
  }
}

/**
 * Build a store over a `Storage`-like object.
 *
 * @param storage The engine to use. Defaults to the browser's `localStorage`; pass an
 *                explicit object in tests, or to scope the app to `sessionStorage`.
 * @returns A {@link KeyValueStore} of kind `local-storage`, or an in-memory store of
 *          kind `memory` when no usable engine was found.
 */
export function createWebKeyValueStore(
  storage: WebStorageLike | null = resolveWebStorage(),
): KeyValueStore {
  if (storage === null) return createMemoryKeyValueStore();

  return {
    kind: 'local-storage',

    getString(key: StorageKey): Promise<string | undefined> {
      try {
        return Promise.resolve(storage.getItem(key) ?? undefined);
      } catch (cause) {
        void cause;
        return Promise.resolve(undefined);
      }
    },

    setString(key: StorageKey, value: string): Promise<void> {
      try {
        storage.setItem(key, value);
      } catch (cause) {
        // Quota exceeded, or storage disabled between the probe and now. Dropping the
        // write is the correct fallback: everything written here is a cache or a
        // preference, and none of it is the only copy of anything.
        void cause;
      }
      return Promise.resolve();
    },

    remove(key: StorageKey): Promise<void> {
      try {
        storage.removeItem(key);
      } catch (cause) {
        void cause;
      }
      return Promise.resolve();
    },
  };
}
