/**
 * The store this platform actually uses — web, and every other non-native target.
 *
 * Purpose
 *   One import, `./device-storage`, that resolves to a different engine per platform.
 *   Metro picks `device-storage.native.ts` for `ios`/`android` and this file for
 *   `web`; TypeScript and the Node test runner, which do no platform resolution, also
 *   land here. Callers never name an engine and never branch on `Platform.OS`.
 *
 * What "non-native" covers
 *   Expo web, plus Vitest under Node. `localStorage` exists in the first and not in the
 *   second, and `createWebKeyValueStore` degrades to memory in the second — which is
 *   the behaviour a test wants anyway.
 *
 * Dependencies
 *   `web-key-value-store.ts`. Deliberately no `react-native-mmkv`: see the header of
 *   `mmkv-key-value-store.native.ts` for why that import may appear in exactly one file.
 */

import type { KeyValueStore } from './key-value-store';
import { createWebKeyValueStore } from './web-key-value-store';

/**
 * The app's persistent store.
 *
 * A module-level singleton because the engines behind it are themselves process-wide:
 * two instances would not give two databases, only two handles onto one. Created
 * eagerly, since both engines are synchronous to open and the device id is needed
 * before the first request.
 */
export const deviceKeyValueStore: KeyValueStore = createWebKeyValueStore();
