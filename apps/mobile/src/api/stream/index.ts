/**
 * Server-Sent Events streaming for grounded AI chat.
 *
 * Purpose
 *   The public surface of `src/api/stream`. Everything a feature needs to stream a reply
 *   from `POST /chat/stream` and render it without melting the render tree.
 *
 * The shape of the thing
 *   ```
 *   transport  ->  parser  ->  client  ->  draft store  ->  the streaming bubble
 *   (bytes)       (pure)      (events)    (one commit/frame)
 *   ```
 *   Each arrow is an interface, not a call into a concrete module. The transport can be
 *   swapped without touching the parser; the store can be replaced without touching the
 *   client. That is the mitigation for `docs/architecture/flutter-port-map.md` risk #1,
 *   which is fundamentally a bet on an unstable platform API.
 *
 * Deliberately not re-exported
 *   `createExpoFetchTransport` from `./expo-fetch-transport`. It imports `expo/fetch`,
 *   which drags in the React Native runtime and cannot load under the Node test runner.
 *   Import it directly from application code — that one extra import line is what keeps
 *   every other module in this folder testable in plain Node.
 *
 * Usage
 *   ```ts
 *   import { createChatStreamClient, chatDraftStore } from '@/api/stream';
 *   import { createExpoFetchTransport } from '@/api/stream/expo-fetch-transport';
 *   ```
 *
 * Background reading
 *   `docs/architecture/spike-sse.md` — the transport comparison, the parser contract, the
 *   re-render strategy, and the Android caveats.
 */

export { isToolUseEmpty, type ChatStreamEvent, type ChatToolUse } from './chat-events';

export {
  chatDraftStore,
  createChatDraftStore,
  selectDraftError,
  selectDraftMeta,
  selectDraftStatus,
  selectDraftText,
  type ChatDraftSlice,
  type ChatDraftState,
  type ChatDraftStatus,
} from './chat-draft-store';

export {
  createChatStreamClient,
  DEFAULT_IDLE_TIMEOUT_MS,
  type ChatMessage,
  type ChatStreamClient,
  type ChatStreamClientOptions,
  type ChatStreamHandlers,
  type ChatStreamRequest,
} from './chat-stream-client';

export {
  finishStream,
  INITIAL_PARSER_STATE,
  pushBytes,
  pushText,
  type ChatStreamParseResult,
  type ChatStreamParserState,
} from './chat-stream-parser';

export {
  ChatStreamAbortedError,
  ChatStreamError,
  ChatStreamHttpError,
  ChatStreamIdleTimeoutError,
  ChatStreamProtocolError,
  ChatStreamServerError,
  ChatStreamTransportError,
  type ChatStreamErrorCode,
} from './errors';

export {
  createFrameThrottle,
  defaultFrameScheduler,
  type FrameScheduler,
  type FrameThrottle,
} from './frame-throttle';

export { parseSseDataLine, SSE_DATA_PREFIX, SSE_DONE_PAYLOAD } from './parse-data-line';

export {
  createStreamingFetchTransport,
  type StreamingFetch,
  type StreamingResponse,
} from './streaming-fetch-transport';

export type { SseChunk, SseRequest, SseTransport, SseTransportId } from './transport';

export { useDraftError, useDraftMeta, useDraftStatus, useDraftText } from './use-chat-draft';

export { createXhrTransport, type XhrFactory } from './xhr-transport';
