/**
 * The storage contract every persisted thing in the client writes through.
 *
 * Purpose
 *   Decision `T-01` made web a first-class target, which rules out `react-native-mmkv`
 *   in any module a browser must load. This interface is the seam that lets the device
 *   id, the reader preferences and the persisted query cache be written once and stored
 *   by whichever engine the running platform actually has.
 *
 * Why the interface is asynchronous when both current engines are synchronous
 *   MMKV and `localStorage` are both synchronous, so a synchronous interface would fit
 *   today and block the obvious third implementation tomorrow: `AsyncStorage` — the
 *   React Native standard, and the only option on a platform where MMKV cannot be
 *   installed — is promise-based. Async is the superset; wrapping a synchronous engine
 *   in a resolved promise costs a microtask, while unwrapping an asynchronous one is
 *   impossible. Every caller already awaits, because every caller is either startup or
 *   a debounced write.
 *
 * Key responsibilities
 *   - Define the four operations the app needs, and no more. There is deliberately no
 *     `getAllKeys`, no `clearAll` and no listener: each would have to be emulated on
 *     some engine, and nothing in the client asks for them.
 *   - Provide the in-memory implementation used by tests and by any platform whose
 *     persistent engine is unavailable, so a missing engine degrades to "forgets on
 *     reload" rather than to a crash (rule 6.4.4, fallback behaviour).
 *
 * Dependencies
 *   None. This module must stay importable from a browser, from Hermes, and from the
 *   Node test runner alike, which is exactly why it names no engine.
 *
 * Usage
 *   ```ts
 *   import { deviceKeyValueStore } from '@/api/storage';
 *   await deviceKeyValueStore.setString('atlas.device-id', id);
 *   ```
 */

/**
 * Where a store keeps its data.
 *
 * Exposed so that startup can tell the difference between "persisted" and "will be
 * forgotten on reload" without inspecting the implementation — a private-mode browser
 * reports `memory`, and the caller may then choose not to promise the reader that their
 * place is saved.
 */
export type KeyValueStoreKind = 'memory' | 'local-storage' | 'mmkv';

/** A namespaced string key. Callers use the constants in `storage-keys.ts`. */
export type StorageKey = string;

/**
 * A minimal, asynchronous string key/value store.
 *
 * Implementations must never throw for an ordinary miss, a full disk, or a disabled
 * engine: a store that throws would turn every read into a `try` at the call site, and
 * losing a cached chapter is not an error the reader should ever see. They report
 * failure by resolving `undefined` from `getString` and by resolving (not rejecting)
 * from the writes.
 */
export interface KeyValueStore {
  /** Which engine backs this store. */
  readonly kind: KeyValueStoreKind;
  /** The stored string, or `undefined` when the key is absent or unreadable. */
  getString(key: StorageKey): Promise<string | undefined>;
  /** Store a string, replacing any previous value. */
  setString(key: StorageKey, value: string): Promise<void>;
  /** Remove a key. Removing an absent key is not an error. */
  remove(key: StorageKey): Promise<void>;
}

/**
 * Build a store that keeps everything in a `Map` and loses it on reload.
 *
 * Used in three places: by unit tests that need a real store with no platform behind
 * it, by the web store when the browser refuses `localStorage` (private mode, blocked
 * third-party storage), and by the Node test runner, where neither engine exists.
 *
 * @returns A fresh, empty store. Two calls never share state. Side effects: none.
 */
export function createMemoryKeyValueStore(): KeyValueStore {
  const entries = new Map<StorageKey, string>();

  return {
    kind: 'memory',

    getString(key: StorageKey): Promise<string | undefined> {
      return Promise.resolve(entries.get(key));
    },

    setString(key: StorageKey, value: string): Promise<void> {
      entries.set(key, value);
      return Promise.resolve();
    },

    remove(key: StorageKey): Promise<void> {
      entries.delete(key);
      return Promise.resolve();
    },
  };
}
