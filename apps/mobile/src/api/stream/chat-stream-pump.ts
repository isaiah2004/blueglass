/**
 * The per-request half of the chat streaming client.
 *
 * Purpose
 *   One streamed reply is a small state machine: parser state carried across chunks, plus
 *   the first failure the frames described. `chat-stream-client.ts` owns configuration —
 *   a URL, a transport, an idle budget — and is created once; this owns the state of a
 *   single in-flight request and is created per call. Splitting them is what keeps both
 *   `createChatStreamClient` and `streamReply` inside rule 5.4.3's 50-line limit.
 *
 * Key responsibilities
 *   - Advance the pure parser by one chunk, whatever encoding the transport produced.
 *   - Deliver each decoded event to the caller's handlers.
 *   - Record the FIRST failure and stop dispatching after it, then let the client abort
 *     the socket rather than draining frames nobody will render.
 *
 * What it does not do
 *   Networking, timers, or aborting. It reports that a failure happened by returning it
 *   from {@link StreamPump.failure}; the client decides what that means for the socket.
 */

import type { ChatStreamEvent } from './chat-events';
import type { ChatStreamHandlers } from './chat-stream-client';
import {
  finishStream,
  INITIAL_PARSER_STATE,
  pushBytes,
  pushText,
  type ChatStreamParseResult,
  type ChatStreamParserState,
} from './chat-stream-parser';
import { ChatStreamProtocolError, ChatStreamServerError } from './errors';
import type { SseChunk } from './transport';

/**
 * Deliver one parsed event.
 *
 * @returns The failure the event represents, or `null` when it was handled. Returning
 *          rather than throwing keeps the failure attributable after the socket closes.
 */
export function dispatchEvent(event: ChatStreamEvent, handlers: ChatStreamHandlers): Error | null {
  switch (event.kind) {
    case 'meta':
      handlers.onMeta?.(event.meta);
      return null;
    case 'delta':
      handlers.onDelta(event.text);
      return null;
    case 'error':
      return new ChatStreamServerError(event.message);
    case 'malformed':
      return new ChatStreamProtocolError(event.line);
    case 'done':
      return null;
  }
}

/** Advance the parser by one chunk, whichever encoding the transport produced. */
function advance(state: ChatStreamParserState, chunk: SseChunk): ChatStreamParseResult {
  return chunk.encoding === 'bytes' ? pushBytes(state, chunk.bytes) : pushText(state, chunk.text);
}

/** The state of one in-flight reply. */
export interface StreamPump {
  /** Feed one transport chunk. Dispatches whatever events it completed. */
  onChunk(chunk: SseChunk): void;
  /** Flush the parser's tail once the socket has closed cleanly. */
  drain(): void;
  /** The first failure the stream described, or `null` if it was well-formed. */
  failure(): Error | null;
}

/**
 * Create the pump for one request.
 *
 * @param handlers  Where `meta` and `delta` events go.
 * @param onFailure Called once, the moment a failure is recorded, so the caller can stop
 *                  the socket. Never called for a healthy stream.
 * @returns A pump. It holds parser state, so never reuse one across requests.
 */
export function createStreamPump(handlers: ChatStreamHandlers, onFailure: () => void): StreamPump {
  let parser = INITIAL_PARSER_STATE;
  let failure: Error | null = null;

  const consume = (events: readonly ChatStreamEvent[]): void => {
    for (const event of events) {
      // `??=` short-circuits, so once a failure is recorded no further event is
      // dispatched. That matches the Dart client, where the first bad frame throws out of
      // the loop and nothing after it reaches the UI.
      failure ??= dispatchEvent(event, handlers);
    }
  };

  return {
    onChunk(chunk: SseChunk): void {
      const step = advance(parser, chunk);
      parser = step.state;
      consume(step.events);
      // An `error` frame is terminal. Stop the socket rather than draining the rest.
      if (failure !== null) onFailure();
    },

    drain(): void {
      consume(finishStream(parser).events);
    },

    failure(): Error | null {
      return failure;
    },
  };
}
