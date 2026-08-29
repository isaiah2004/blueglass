/**
 * The client's networking layer.
 *
 * Purpose
 *   One import point — `@/api` — for everything that talks to the Atlas Bible server:
 *   the typed endpoints, the query cache that holds their answers, the identity every
 *   request carries, and the storage all of it persists through.
 *
 * The shape of the thing
 *   ```
 *   query/     TanStack Query hooks        <- what components use
 *     |
 *   endpoints/ typed methods + decoders    <- what a test doubles
 *     |
 *   client/    timeouts, retries, errors   <- what makes a request survive a train
 *     |
 *   identity/  the device-id header        <- the one seam accounts will replace
 *   storage/   localStorage | MMKV         <- the one seam the browser needs
 *   stream/    SSE, for chat only
 *   ```
 *   Each layer depends only on the one below it, and each is testable under plain Node
 *   because every platform dependency arrives by injection.
 *
 * Deliberately not re-exported
 *   - `createExpoFetchTransport` from `./stream/expo-fetch-transport` — it imports
 *     `expo/fetch` and cannot load under the Node test runner.
 *   - `createMmkvKeyValueStore` from `./storage/mmkv-key-value-store.native` — a native
 *     module must not appear in a barrel the web bundle loads.
 *   Both are documented at their own module headers, and both are imported directly by
 *   the one place that needs them.
 *
 * Usage
 *   ```ts
 *   import { useChapterQuery, atlasApi, deviceIdentity } from '@/api';
 *   ```
 */

export { atlasApi, atlasHttpClient } from './atlas-client';

export * from './client';
export * from './endpoints';
export * from './identity';
export * from './query';
export * from './storage';
export * from './stream';
