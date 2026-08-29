/**
 * Universal fallback transport: `XMLHttpRequest` + incremental `responseText`.
 *
 * Purpose
 *   The mitigation of last resort named in `docs/architecture/flutter-port-map.md` risk #1.
 *   Every JavaScript runtime React Native has ever shipped on has `XMLHttpRequest`, and
 *   while `readyState === LOADING` its `responseText` grows as bytes arrive. Slicing off
 *   the part not yet seen gives a chunk stream. This is the technique `react-native-sse`
 *   uses, reimplemented in seventy lines against our own transport seam so that adopting
 *   it costs no dependency and no second parser.
 *
 * Key responsibilities
 *   - Deliver `responseText` deltas as `text` chunks, in order.
 *   - Map every XHR outcome to a typed `ChatStreamError`.
 *   - Honour `AbortSignal` by aborting the request.
 *
 * The cost of using it — read before switching
 *   It delivers *text*, not bytes, so the platform's decoder — not `utf8.ts` — decides
 *   what happens when a chunk boundary splits a multi-byte character. React Native's
 *   Android implementation decodes each network packet independently, so a split `—` or a
 *   curly quote can surface as U+FFFD and stay wrong forever. It also keeps the entire
 *   response in memory, since `responseText` only ever grows. Use it only where
 *   `expo/fetch` is unavailable.
 */

import { ChatStreamAbortedError, ChatStreamHttpError, ChatStreamTransportError } from './errors';
import type { SseChunk, SseRequest, SseTransport } from './transport';

/** `readyState` values used here. Named because a bare `3` explains nothing. */
const READY_STATE_LOADING = 3;
const READY_STATE_DONE = 4;

/** HTTP status the SSE endpoint must answer with. */
const EXPECTED_STATUS = 200;

/** `status` before any response line has been received. */
const NO_STATUS = 0;

/** A factory so tests can supply a fake. Defaults to the platform global. */
export type XhrFactory = () => XMLHttpRequest;

/** Everything one in-flight request needs to hand to its callbacks. */
interface XhrRunContext {
  readonly xhr: XMLHttpRequest;
  readonly onChunk: (chunk: SseChunk) => void;
  readonly settle: (error?: Error) => void;
}

/** Forward whatever part of `responseText` has not been seen yet. Returns the new cursor. */
function drainResponseText(context: XhrRunContext, seen: number): number {
  const text = context.xhr.responseText;
  if (text.length <= seen) return seen;
  context.onChunk({ encoding: 'text', text: text.slice(seen) });
  return text.length;
}

/** Wire the request's lifecycle callbacks. Split out to keep `stream` under the size cap. */
function attachHandlers(context: XhrRunContext): void {
  let seen = 0;
  context.xhr.onreadystatechange = (): void => {
    if (context.xhr.readyState === READY_STATE_LOADING) {
      seen = drainResponseText(context, seen);
      return;
    }
    if (context.xhr.readyState !== READY_STATE_DONE) return;
    if (context.xhr.status === NO_STATUS) {
      // `status === 0` at DONE means the request never reached a response: a DNS failure,
      // a CORS rejection, or an abort. It is not an HTTP 0.
      context.settle(new ChatStreamTransportError('XMLHttpRequest chat stream did not connect.'));
      return;
    }
    if (context.xhr.status !== EXPECTED_STATUS) {
      context.settle(new ChatStreamHttpError(context.xhr.status, context.xhr.responseText));
      return;
    }
    seen = drainResponseText(context, seen);
    context.settle();
  };
  context.xhr.onerror = (): void => {
    context.settle(new ChatStreamTransportError('XMLHttpRequest chat stream failed to connect.'));
  };
  context.xhr.ontimeout = (): void => {
    context.settle(new ChatStreamTransportError('XMLHttpRequest chat stream timed out.'));
  };
  context.xhr.onabort = (): void => {
    context.settle(new ChatStreamAbortedError());
  };
}

/** Open the request with its headers applied. */
function openRequest(xhr: XMLHttpRequest, request: SseRequest): void {
  xhr.open('POST', request.url, true);
  // `text` is mandatory: any other responseType makes `responseText` unreadable mid-flight.
  xhr.responseType = 'text';
  for (const [name, value] of Object.entries(request.headers)) {
    xhr.setRequestHeader(name, value);
  }
}

/**
 * Build the `XMLHttpRequest` fallback transport.
 *
 * @param createXhr Factory for the request object. Defaults to `new XMLHttpRequest()`;
 *                  tests inject a double.
 * @returns A transport identified as `xhr`.
 */
export function createXhrTransport(
  createXhr: XhrFactory = (): XMLHttpRequest => new XMLHttpRequest(),
): SseTransport {
  return {
    id: 'xhr',
    stream(request: SseRequest, onChunk: (chunk: SseChunk) => void): Promise<void> {
      if (request.signal?.aborted === true) return Promise.reject(new ChatStreamAbortedError());

      return new Promise<void>((resolve, reject) => {
        const xhr = createXhr();
        let settled = false;
        const settle = (error?: Error): void => {
          if (settled) return;
          settled = true;
          request.signal?.removeEventListener('abort', onAbort);
          if (error === undefined) resolve();
          else reject(error);
        };
        const onAbort = (): void => {
          // Settle first: a real `abort()` fires `readystatechange` with `status === 0`
          // before it fires `abort`, and the caller deserves the accurate reason.
          settle(new ChatStreamAbortedError());
          xhr.abort();
        };

        request.signal?.addEventListener('abort', onAbort);
        attachHandlers({ xhr, onChunk, settle });
        openRequest(xhr, request);
        xhr.send(request.body);
      });
    },
  };
}
