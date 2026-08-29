/**
 * Persistent key/value storage for the Expo client.
 *
 * Purpose
 *   The public surface of `src/api/storage`. One import for the store the running
 *   platform uses, the contract it satisfies, and the keys the app writes.
 *
 * The shape of the thing
 *   ```
 *   device-storage.ts         -> web-key-value-store.ts   -> localStorage | memory
 *   device-storage.native.ts  -> mmkv-key-value-store.native.ts -> MMKV
 *   ```
 *   Metro picks the row; nothing else in the app knows there are two.
 *
 * The rule this folder exists to enforce
 *   **`react-native-mmkv` may be imported by exactly one file**, and its name ends in
 *   `.native.ts` so the browser bundle cannot reach it. Decision `T-01` made web a
 *   first-class target and the port map's risk list is explicit that a native-only
 *   dependency in shared code is how that gets broken. Enforced three ways — see the
 *   header of `mmkv-key-value-store.native.ts`.
 *
 * Deliberately not re-exported
 *   `createMmkvKeyValueStore` from `./mmkv-key-value-store.native`. Re-exporting it here
 *   would put the native import into a barrel every module loads, which is exactly the
 *   mistake the folder is designed to prevent.
 *
 * Usage
 *   ```ts
 *   import { deviceKeyValueStore, DEVICE_ID_STORAGE_KEY } from '@/api/storage';
 *   ```
 */

export { deviceKeyValueStore } from './device-storage';

export {
  createMemoryKeyValueStore,
  type KeyValueStore,
  type KeyValueStoreKind,
  type StorageKey,
} from './key-value-store';

export {
  DEVICE_ID_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  QUERY_CACHE_STORAGE_KEY,
  READER_POSITION_STORAGE_KEY,
  THEME_PREFERENCE_STORAGE_KEY,
} from './storage-keys';

export {
  createWebKeyValueStore,
  resolveWebStorage,
  type WebStorageLike,
} from './web-key-value-store';
