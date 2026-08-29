/**
 * The native implementation of {@link KeyValueStore}, backed by MMKV.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  THIS IS THE ONLY FILE IN THE REPOSITORY THAT MAY IMPORT `react-native-mmkv`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Why the filename ends in `.native.ts`
 *   `react-native-mmkv` is a native module and decision `T-01` made the browser a
 *   first-class target, so importing it from a module the web bundle loads would break
 *   the web build outright. Metro resolves `foo.native.ts` for `ios`/`android` and
 *   *never* for `platform=web`, so this extension does not merely discourage the wrong
 *   import — it makes it unreachable from the web bundle by construction. The web build
 *   cannot pull this file in even if someone tries.
 *
 *   Three defences, in order of how early they fire:
 *     1. `no-restricted-imports` in `eslint.config.mjs` rejects the import in any file
 *        that is not `*.native.ts` — a lint error while you type.
 *     2. `native-import-guard.test.ts` re-asserts the same rule over the source tree,
 *        so `pnpm test` fails even if the lint config is ever relaxed.
 *     3. Metro's platform resolution, above — the bundle-level guarantee.
 *
 * Why MMKV at all, given that `localStorage` would compile everywhere
 *   The persisted query cache is written on a debounce during scrolling and read in
 *   full at cold start. MMKV is memory-mapped and roughly an order of magnitude faster
 *   than `AsyncStorage` for exactly that access pattern, and it is already a dependency
 *   of this app. The interface means using it costs one file rather than a platform
 *   branch at every call site.
 *
 * Dependencies
 *   `react-native-mmkv` and `key-value-store.ts`. Nothing else.
 */

import { createMMKV, type MMKV } from 'react-native-mmkv';

import type { KeyValueStore, StorageKey } from './key-value-store';

/**
 * The MMKV instance id.
 *
 * Named rather than defaulted so the app's data is separable from any library that
 * also uses MMKV, and so that clearing Atlas Bible's storage never touches theirs.
 */
export const MMKV_INSTANCE_ID = 'atlas-bible';

/**
 * Build a store over an MMKV instance.
 *
 * @param storage The instance to use. Defaults to the app's own; injectable so that a
 *                device-level test can supply a scratch instance.
 * @returns A {@link KeyValueStore} of kind `mmkv`.
 */
export function createMmkvKeyValueStore(
  storage: MMKV = createMMKV({ id: MMKV_INSTANCE_ID }),
): KeyValueStore {
  return {
    kind: 'mmkv',

    getString(key: StorageKey): Promise<string | undefined> {
      return Promise.resolve(storage.getString(key));
    },

    setString(key: StorageKey, value: string): Promise<void> {
      storage.set(key, value);
      return Promise.resolve();
    },

    remove(key: StorageKey): Promise<void> {
      storage.remove(key);
      return Promise.resolve();
    },
  };
}
