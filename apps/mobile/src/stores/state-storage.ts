/**
 * Adapt the app's {@link KeyValueStore} to Zustand's persistence interface.
 *
 * Purpose
 *   Zustand's `persist` middleware wants a `StateStorage` — three methods, each allowed
 *   to be asynchronous. The app's storage seam is already exactly that shape, one
 *   rename apart. This adapter is that rename, and it is what lets a persisted store be
 *   written once and work on web (`localStorage`) and on Android (MMKV) with no
 *   platform branch, honouring decision `T-01`.
 *
 * Why a store must never import a storage engine directly
 *   `react-native-mmkv` has no browser build. A store that reached for it would compile,
 *   pass its unit tests under Node, and break the web bundle — the exact failure mode
 *   `T-01` exists to prevent. Going through this adapter makes that impossible without
 *   deleting the adapter first.
 *
 * On `null` versus `undefined`
 *   `KeyValueStore` reports an absent key as `undefined`; `StateStorage` reports it as
 *   `null`. Converting here rather than at each store keeps the two vocabularies from
 *   leaking into each other, and keeps the mistake of returning the *string* `'null'`
 *   out of reach.
 *
 * Dependencies
 *   `zustand/middleware` for the interface, and `@/api/storage` for the engine.
 */

import type { StateStorage } from 'zustand/middleware';

import { deviceKeyValueStore, type KeyValueStore } from '@/api/storage';

/**
 * Wrap a key/value store as Zustand state storage.
 *
 * @param store - The engine to write through. Defaults to the platform's.
 * @returns A `StateStorage`. Side effects: none until a method is called.
 */
export function toStateStorage(store: KeyValueStore = deviceKeyValueStore): StateStorage {
  return {
    async getItem(name: string): Promise<string | null> {
      return (await store.getString(name)) ?? null;
    },
    async setItem(name: string, value: string): Promise<void> {
      await store.setString(name, value);
    },
    async removeItem(name: string): Promise<void> {
      await store.remove(name);
    },
  };
}
