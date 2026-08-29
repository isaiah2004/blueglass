/**
 * The transport seam.
 *
 * Purpose
 *   `docs/architecture/flutter-port-map.md` risk #1 is that no single HTTP API streams a
 *   response body on every platform React Native runs on. The mitigation is not to pick
 *   the right one forever — it is to make the choice reversible. Everything above this
 *   interface (the parser, the client, the store) is written against these types and has
 *   no idea which implementation is underneath.
 *
 * Key responsibilities
 *   - Describe a streaming POST in platform-neutral terms.
 *   - Define how a chunk is delivered: bytes when the platform can, text when it cannot.
 *   - Say nothing about SSE. A transport moves chunks; `chat-stream-parser.ts` interprets them.
 *
 * Implementations
 *   - `streaming-fetch-transport.ts` — any `fetch` whose `Response.body` is a readable
 *     stream. Used with `expo/fetch` on device and with Node's global `fetch` in tests.
 *   - `xhr-transport.ts` — `XMLHttpRequest` + `onprogress`, the universal fallback.
 */

/** A streaming POST, fully described. */
export interface SseRequest {
  /** Absolute URL, already joined with the API base. */
  readonly url: string;
  /** Serialised JSON request body. */
  readonly body: string;
  /** Request headers. The client always sets `Content-Type` and `Accept`. */
  readonly headers: Readonly<Record<string, string>>;
  /** Cancels the turn. The transport must reject with `ChatStreamAbortedError`. */
  readonly signal?: AbortSignal | undefined;
}

/**
 * One delivered chunk.
 *
 * `bytes` is the honest shape: the transport passes on exactly what the socket produced
 * and the parser owns UTF-8. `text` means the platform already decoded, and the parser
 * must trust it about character boundaries.
 */
export type SseChunk =
  | { readonly encoding: 'bytes'; readonly bytes: Uint8Array }
  | { readonly encoding: 'text'; readonly text: string };

/** Which implementation produced a stream. Surfaced in logs and in the spike doc. */
export type SseTransportId = 'expo-fetch' | 'streaming-fetch' | 'xhr';

/**
 * A streaming HTTP transport.
 *
 * Responsibilities: open the request, deliver every chunk in order, and settle. It owns
 * connection failure and cancellation. It does not own parsing, buffering, retry, or the
 * idle timeout — those belong to `chat-stream-client.ts`.
 */
export interface SseTransport {
  /** Identifies the implementation. */
  readonly id: SseTransportId;

  /**
   * Open the request and stream it to completion.
   *
   * @param request  What to send.
   * @param onChunk  Called synchronously, in order, for every chunk received. Must not
   *                 be called after the returned promise settles.
   * @returns Resolves when the response body ends normally.
   * @throws {ChatStreamHttpError} The response status was not `200`.
   * @throws {ChatStreamAbortedError} `request.signal` fired.
   * @throws {ChatStreamTransportError} The connection failed or dropped mid-body.
   */
  stream(request: SseRequest, onChunk: (chunk: SseChunk) => void): Promise<void>;
}
