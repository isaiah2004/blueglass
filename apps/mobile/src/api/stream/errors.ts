/**
 * Typed failures for the chat streaming client.
 *
 * Purpose
 *   Rule 6.1.3 forbids `throw new Error('stream failed')`. A streaming chat turn can fail
 *   in five materially different ways, and the UI reacts differently to each: an aborted
 *   turn shows nothing, a server error shows the server's message, a transport error
 *   offers retry, an HTTP error is a bug report, and a protocol error means the contract
 *   drifted. Each gets a class and a stable code.
 *
 * Key responsibilities
 *   - Give every stream failure a specific type and a machine-readable `code`.
 *   - Preserve the original error via `cause` whenever one is wrapped (rule 6.2.2).
 *   - Map transport-level failures to domain failures at the adapter boundary (rule 6.2.4),
 *     so no consumer ever catches an `XMLHttpRequest` event or a `TypeError` from `fetch`.
 *
 * Deliberate omission
 *   No error carries the request body. Chat messages are user content, and rule 7.1.4
 *   keeps user content out of anything that may end up in a log.
 */

/** Stable, machine-readable failure codes. Never renumber or reuse a retired code. */
export type ChatStreamErrorCode =
  | 'STREAM_HTTP_ERROR'
  | 'STREAM_SERVER_ERROR'
  | 'STREAM_TRANSPORT_ERROR'
  | 'STREAM_PROTOCOL_ERROR'
  | 'STREAM_ABORTED'
  | 'STREAM_IDLE_TIMEOUT';

/** Base class for everything the streaming client throws. */
export class ChatStreamError extends Error {
  readonly code: ChatStreamErrorCode;

  constructor(code: ChatStreamErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * The server answered, but not with `200`.
 *
 * The body is read and attached because FastAPI puts the reason there — a missing
 * `OPENROUTER_API_KEY` surfaces as a 500 with a readable `detail`.
 */
export class ChatStreamHttpError extends ChatStreamError {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super('STREAM_HTTP_ERROR', `Chat stream rejected with HTTP ${String(status)}.`);
    this.status = status;
    this.body = body;
  }
}

/**
 * The stream carried a `data: {"error": "..."}` frame.
 *
 * This is a *successful* HTTP response that failed mid-generation — the provider timed
 * out, or refused. The server always follows it with `[DONE]`, so partial text already
 * rendered stays valid; only the completion is lost.
 */
export class ChatStreamServerError extends ChatStreamError {
  constructor(message: string) {
    super('STREAM_SERVER_ERROR', message);
  }
}

/** The connection failed, dropped, or never opened. Retryable. */
export class ChatStreamTransportError extends ChatStreamError {
  constructor(message: string, options?: ErrorOptions) {
    super('STREAM_TRANSPORT_ERROR', message, options);
  }
}

/**
 * A frame did not match the wire contract.
 *
 * Matches the Dart client, where `jsonDecode` on a corrupt payload throws and ends the
 * turn. Treated as a bug rather than a transient fault: if this fires, the server and
 * `parse-data-line.ts` disagree and someone must look.
 */
export class ChatStreamProtocolError extends ChatStreamError {
  readonly line: string;

  constructor(line: string) {
    super('STREAM_PROTOCOL_ERROR', 'Chat stream sent a frame that is not valid SSE JSON.');
    this.line = line;
  }
}

/** The caller aborted the turn. Expected control flow, not a fault; render nothing. */
export class ChatStreamAbortedError extends ChatStreamError {
  constructor() {
    super('STREAM_ABORTED', 'Chat stream was cancelled by the caller.');
  }
}

/**
 * No bytes arrived for longer than the idle budget (rule 6.4.1: no indefinite waits).
 *
 * An idle timeout, not a total one: a long grounded answer may legitimately stream for
 * minutes, but a silent socket for a minute is dead.
 */
export class ChatStreamIdleTimeoutError extends ChatStreamError {
  readonly idleMs: number;

  constructor(idleMs: number) {
    super('STREAM_IDLE_TIMEOUT', `Chat stream sent nothing for ${String(idleMs)}ms.`);
    this.idleMs = idleMs;
  }
}
