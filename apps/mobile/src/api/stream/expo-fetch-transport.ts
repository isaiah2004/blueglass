/**
 * The production transport: Expo's streaming `fetch`.
 *
 * Purpose
 *   `docs/architecture/flutter-port-map.md` risk #1 records that React Native's built-in
 *   `fetch` is XHR-backed and never exposes `response.body`. Expo SDK 52 added a separate
 *   `fetch` under `expo/fetch` that does, implemented natively on iOS and Android; on web
 *   it is simply the browser's own `fetch`. SDK 57 (this project) ships it in `expo` core,
 *   so it needs no extra dependency and works in Expo Go.
 *
 * Key responsibilities
 *   - Be the *only* module in the app that imports `expo/fetch`.
 *   - Adapt it to the transport seam with no logic of its own.
 *
 * Why it is a separate file
 *   Importing `expo/fetch` pulls in the React Native runtime, which cannot load under the
 *   Node test runner. Keeping the import isolated here means every other module in this
 *   folder — the parser, the client, the store — stays testable in plain Node, and the
 *   streaming logic itself is exercised for real by `streaming-fetch-transport.ts` against
 *   Node's global `fetch`.
 *
 * Usage
 *   ```ts
 *   const client = createChatStreamClient({ baseUrl, transport: createExpoFetchTransport() });
 *   ```
 */

import { fetch as expoFetch } from 'expo/fetch';

import { createStreamingFetchTransport } from './streaming-fetch-transport';
import type { SseTransport } from './transport';

/**
 * Build the Expo streaming transport.
 *
 * @returns A transport backed by `expo/fetch`, identified as `expo-fetch`.
 */
export function createExpoFetchTransport(): SseTransport {
  return createStreamingFetchTransport(expoFetch, 'expo-fetch');
}
