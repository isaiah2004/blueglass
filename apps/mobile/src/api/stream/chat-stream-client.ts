/**
 * The grounded-chat streaming client.
 *
 * Purpose
 *   Wires the three independent pieces together — a transport, the pure parser, and the
 *   typed error set — into the one call a feature makes: "stream this reply". It is the
 *   Expo replacement for `app/lib/services/chat_service.dart` and speaks the same wire
 *   contract, described in `docs/architecture/flutter-port-map.md` §5, endpoint 3.
 *
 * Key responsibilities
 *   - Build the `POST /chat/stream` request, including the `Authorization` header the
 *     Flutter client never sent (port map §5 and risk #9: do auth properly from day one).
 *   - Feed every chunk through the parser and dispatch the events to the caller.
 *   - Enforce an idle timeout, and translate every failure into a `ChatStreamError`.
 *
 * What it does not do
 *   Own state. It reports events; `chat-draft-store.ts` decides what to render and when.
 *   Keeping those apart is what makes the per-token render cost a store concern rather
 *   than a networking one.
 *
 * Usage
 *   ```ts
 *   const client = createChatStreamClient({
 *     baseUrl: 'http://localhost:8000',
 *     transport: createExpoFetchTransport(),
 *   });
 *   await client.streamReply(
 *     { messages, useRag: true, webSearch: false },
 *     { onMeta: draft.applyMeta, onDelta: draft.appendDelta },
 *     controller.signal,
 *   );
 *   ```
 */

import type { ChatToolUse } from './chat-events';
import { createStreamPump } from './chat-stream-pump';
import { ChatStreamIdleTimeoutError } from './errors';
import { createIdleWatchdog, defaultTimerApi, type TimerApi } from './idle-watchdog';
import type { SseRequest, SseTransport } from './transport';

/** One turn in the conversation, in the shape the server's `ChatMessage` model accepts. */
export interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  /** Tool-use record on an assistant turn. The server's Pydantic model drops it silently. */
  readonly tools?: ChatToolUse;
}

/** What to ask for. The full history is sent every turn — the server holds no session. */
export interface ChatStreamRequest {
  readonly messages: readonly ChatMessage[];
  /** Retrieve from the user's own library before answering. */
  readonly useRag: boolean;
  /** Let the provider's web-search plugin run. */
  readonly webSearch: boolean;
}

/** Where events go. `onDelta` is called once per token; keep it to a buffer append. */
export interface ChatStreamHandlers {
  /** The one-off tool-use frame, delivered before the first token. */
  onMeta?(meta: ChatToolUse): void;
  /** One token of the reply. */
  onDelta(text: string): void;
}

/** Construction options. */
export interface ChatStreamClientOptions {
  /** API root, e.g. `http://localhost:8000`. A trailing slash is tolerated. */
  readonly baseUrl: string;
  /** The transport to stream over. */
  readonly transport: SseTransport;
  /** Supplies the bearer token, or `null` while signed out. Called once per request. */
  readonly authToken?: () => string | null;
  /** Silence budget between chunks. Defaults to {@link DEFAULT_IDLE_TIMEOUT_MS}. */
  readonly idleTimeoutMs?: number;
  /** Timer implementation for the idle watchdog. Tests inject a double. */
  readonly timers?: TimerApi;
}

/** The client surface. */
export interface ChatStreamClient {
  /**
   * Stream one assistant reply.
   *
   * @param request  Conversation history and retrieval flags.
   * @param handlers Where to send `meta` and `delta` events.
   * @param signal   Cancels the turn.
   * @returns Resolves when the reply has been fully delivered and the socket has closed.
   * @throws {ChatStreamHttpError} Non-200 response.
   * @throws {ChatStreamServerError} The stream carried an `error` frame.
   * @throws {ChatStreamProtocolError} A frame did not match the contract.
   * @throws {ChatStreamIdleTimeoutError} No chunk arrived within the idle budget.
   * @throws {ChatStreamAbortedError} `signal` fired.
   * @throws {ChatStreamTransportError} The connection failed.
   */
  streamReply(
    request: ChatStreamRequest,
    handlers: ChatStreamHandlers,
    signal?: AbortSignal,
  ): Promise<void>;
}

/** Sixty seconds of silence on an open socket means the far end is gone. */
export const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

/** The streaming endpoint's path, relative to the API root. */
const STREAM_PATH = '/chat/stream';

/** Trailing slashes on a configured base URL, which would otherwise double up. */
const TRAILING_SLASHES = /\/+$/;

/** Serialise the request body exactly as the server's `ChatRequest` schema expects. */
function toRequestBody(request: ChatStreamRequest): string {
  return JSON.stringify({
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.tools === undefined ? {} : { tools: message.tools }),
    })),
    use_rag: request.useRag,
    web_search: request.webSearch,
  });
}

/** Build the request headers, including auth when a token is available. */
function toHeaders(authToken: (() => string | null) | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  const token = authToken?.() ?? null;
  if (token !== null && token.length > 0) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Mirror an external abort onto the request's own controller.
 *
 * The client always aborts through a controller it owns, because the idle watchdog and a
 * terminal `error` frame must be able to stop the socket too. The caller's signal is one
 * more input to that, not a replacement for it.
 *
 * @returns The detach function. Call it in `finally`, or a long-lived caller signal
 *          accumulates one listener per request.
 */
function forwardAbort(controller: AbortController, signal: AbortSignal | undefined): () => void {
  if (signal === undefined) return (): void => undefined;
  const onAbort = (): void => {
    controller.abort();
  };
  signal.addEventListener('abort', onAbort);
  return (): void => {
    signal.removeEventListener('abort', onAbort);
  };
}

/** Everything one request needs, resolved once at construction. */
interface StreamConfig {
  readonly url: string;
  readonly transport: SseTransport;
  readonly authToken: (() => string | null) | undefined;
  readonly idleTimeoutMs: number;
  readonly timers: TimerApi;
}

/** Describe the streaming POST for this turn. */
function toSseRequest(
  config: StreamConfig,
  request: ChatStreamRequest,
  signal: AbortSignal,
): SseRequest {
  return {
    url: config.url,
    body: toRequestBody(request),
    headers: toHeaders(config.authToken),
    signal,
  };
}

/**
 * Stream one reply.
 *
 * Lives at module level rather than inside the factory so that the state of a request
 * (its controller, watchdog, and pump) is visibly separate from the configuration of the
 * client, and so neither function has to carry both.
 *
 * @throws The typed errors documented on {@link ChatStreamClient.streamReply}.
 */
async function runStream(
  config: StreamConfig,
  request: ChatStreamRequest,
  handlers: ChatStreamHandlers,
  signal: AbortSignal | undefined,
): Promise<void> {
  const controller = new AbortController();
  const detach = forwardAbort(controller, signal);
  let idle = false;

  const watchdog = createIdleWatchdog(
    config.idleTimeoutMs,
    () => {
      idle = true;
      controller.abort();
    },
    config.timers,
  );
  const pump = createStreamPump(handlers, () => {
    controller.abort();
  });

  try {
    watchdog.touch();
    await config.transport.stream(toSseRequest(config, request, controller.signal), (chunk) => {
      watchdog.touch();
      pump.onChunk(chunk);
    });
    pump.drain();
  } catch (cause) {
    // A failure already recorded from the stream body is more specific than the abort or
    // socket error it caused, so it wins.
    const recorded = pump.failure();
    if (recorded !== null) throw recorded;
    if (idle) throw new ChatStreamIdleTimeoutError(config.idleTimeoutMs);
    throw cause;
  } finally {
    watchdog.stop();
    detach();
  }

  const recorded = pump.failure();
  if (recorded !== null) throw recorded;
}

/**
 * Create the client.
 *
 * @param options See {@link ChatStreamClientOptions}.
 * @returns A client bound to one base URL and one transport.
 */
export function createChatStreamClient(options: ChatStreamClientOptions): ChatStreamClient {
  const config: StreamConfig = {
    url: `${options.baseUrl.replace(TRAILING_SLASHES, '')}${STREAM_PATH}`,
    transport: options.transport,
    authToken: options.authToken,
    idleTimeoutMs: options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
    timers: options.timers ?? defaultTimerApi,
  };

  return {
    streamReply(
      request: ChatStreamRequest,
      handlers: ChatStreamHandlers,
      signal?: AbortSignal,
    ): Promise<void> {
      return runStream(config, request, handlers, signal);
    },
  };
}
