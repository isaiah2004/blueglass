/**
 * The store this platform actually uses — Android (and any future native target).
 *
 * Purpose
 *   The `.native` half of the pair described in `device-storage.ts`. Metro resolves
 *   this file for `platform=ios` and `platform=android` and never for `platform=web`,
 *   so the MMKV dependency it pulls in cannot reach the browser bundle.
 *
 * Keep this file trivial
 *   It exists to make one choice. Any logic added here would exist only on native and
 *   would therefore be untestable under the Node runner and unreviewable against the
 *   web behaviour beside it. Logic belongs in `mmkv-key-value-store.native.ts` (which
 *   at least takes its instance by injection) or, better, in the platform-free modules.
 *
 * Dependencies
 *   `mmkv-key-value-store.native.ts`.
 */

import type { KeyValueStore } from './key-value-store';
import { createMmkvKeyValueStore } from './mmkv-key-value-store.native';

/** The app's persistent store. See the note on the web twin about the singleton. */
export const deviceKeyValueStore: KeyValueStore = createMmkvKeyValueStore();
