/**
 * Streaming transport built on any `fetch` that exposes `Response.body` as a stream.
 *
 * Purpose
 *   The chosen primary transport. It is written against a *structural* fetch type rather
 *   than importing one, which is what lets the identical code path run in three places:
 *   `expo/fetch` on iOS and Android, the browser's `fetch` on Expo web, and Node's global
 *   `fetch` in tests and in the local spike harness. The code that ships to a device is
 *   therefore the code that was proven against a real HTTP server.
 *
 * Key responsibilities
 *   - Open the streaming POST and reject non-`200` responses with the body attached.
 *   - Deliver every chunk as raw bytes, in order, so `utf8.ts` owns character boundaries.
 *   - Map every failure to a typed `ChatStreamError` (rule 6.2.4) and release the socket.
 *
 * What it does not do
 *   Retry, buffer, time out, or parse. Those belong to `chat-stream-client.ts`.
 *
 * Usage
 *   ```ts
 *   import { fetch as expoFetch } from 'expo/fetch';
 *   const transport = createStreamingFetchTransport(expoFetch, 'expo-fetch');
 *   ```
 */

import { ChatStreamAbortedError, ChatStreamHttpError, ChatStreamTransportError } from './errors';
import type { SseChunk, SseRequest, SseTransport, SseTransportId } from './transport';

/** The reader half of a byte stream. Structurally satisfied by `ReadableStreamDefaultReader`. */
export interface StreamingResponseReader {
  read(): Promise<{ done: boolean; value?: Uint8Array | undefined }>;
  cancel(reason?: unknown): Promise<void>;
}

/** The body half. Structurally satisfied by `ReadableStream<Uint8Array>`. */
export interface StreamingResponseBody {
  getReader(): StreamingResponseReader;
}

/** The subset of `Response` this transport touches. */
export interface StreamingResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: StreamingResponseBody | null;
  text(): Promise<string>;
}

/** The request options this transport sends. Compatible with `RequestInit`. */
export interface StreamingFetchInit {
  readonly method: string;
  readonly body: string;
  readonly headers: Record<string, string>;
  readonly signal?: AbortSignal | null;
}

/** Any fetch implementation whose response body is readable as a stream. */
export type StreamingFetch = (url: string, init: StreamingFetchInit) => Promise<StreamingResponse>;

/** HTTP status the SSE endpoint must answer with. Anything else is a failure. */
const EXPECTED_STATUS = 200;

/** Turn whatever the platform threw into the right domain error. */
function translateStreamFailure(cause: unknown, signal: AbortSignal | undefined): Error {
  if (signal?.aborted === true) return new ChatStreamAbortedError();
  const detail = cause instanceof Error ? cause.message : 'unknown transport failure';
  return new ChatStreamTransportError(`Chat stream connection failed: ${detail}`, { cause });
}

/**
 * Release the socket after a failure.
 *
 * A cancel that itself fails is not re-thrown: the caller is already propagating a more
 * meaningful error, and masking it with a teardown failure would lose the real cause.
 * Named here rather than swallowed anonymously (rule 6.1.1).
 */
async function releaseReader(reader: StreamingResponseReader): Promise<void> {
  try {
    await reader.cancel();
  } catch (teardownError) {
    void teardownError;
  }
}

/** Open the request and reject anything that is not a streaming `200`. */
async function openStream(
  fetchImpl: StreamingFetch,
  request: SseRequest,
): Promise<StreamingResponse> {
  let response: StreamingResponse;
  try {
    response = await fetchImpl(request.url, {
      method: 'POST',
      body: request.body,
      headers: { ...request.headers },
      signal: request.signal ?? null,
    });
  } catch (cause) {
    throw translateStreamFailure(cause, request.signal);
  }

  if (response.status !== EXPECTED_STATUS) {
    throw new ChatStreamHttpError(response.status, await response.text());
  }
  return response;
}

/** Drain the reader, forwarding every chunk. */
async function pump(
  reader: StreamingResponseReader,
  onChunk: (chunk: SseChunk) => void,
): Promise<void> {
  for (;;) {
    const result = await reader.read();
    if (result.done) return;
    const bytes = result.value;
    // A zero-length chunk is legal and carries no data; forwarding it would only churn.
    if (bytes !== undefined && bytes.length > 0) {
      onChunk({ encoding: 'bytes', bytes });
    }
  }
}

/**
 * Build a transport from a streaming `fetch`.
 *
 * @param fetchImpl A fetch whose `Response.body` is a readable byte stream. On a platform
 *                  where it is not, the transport fails fast with a transport error rather
 *                  than silently buffering the whole reply.
 * @param id        Which implementation this is, for logs and diagnostics.
 * @returns A transport ready to hand to `createChatStreamClient`.
 */
export function createStreamingFetchTransport(
  fetchImpl: StreamingFetch,
  id: SseTransportId = 'streaming-fetch',
): SseTransport {
  return {
    id,
    async stream(request: SseRequest, onChunk: (chunk: SseChunk) => void): Promise<void> {
      if (request.signal?.aborted === true) throw new ChatStreamAbortedError();

      const response = await openStream(fetchImpl, request);
      const body = response.body;
      if (body === null) {
        throw new ChatStreamTransportError(
          `Transport "${id}" returned a response with no readable body. This platform ` +
            'cannot stream; use the XMLHttpRequest fallback instead.',
        );
      }

      const reader = body.getReader();
      try {
        await pump(reader, onChunk);
      } catch (cause) {
        await releaseReader(reader);
        throw translateStreamFailure(cause, request.signal);
      }
    },
  };
}
