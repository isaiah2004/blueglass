/**
 * Tests for the chat streaming client's failure paths.
 *
 * Split from `chat-stream-client.test.ts` to stay under the 300-line file cap. The happy
 * path lives there; everything that ends a turn early lives here — error frames, corrupt
 * frames, dropped sockets, silence, and cancellation.
 *
 * The theme running through these: the reason a turn ended must survive all the way to
 * the caller. A stream that fails because the model refused must not surface as a
 * cancellation, even though the client does cancel the socket in response.
 */

import { describe, expect, it, vi } from 'vitest';

import { createChatStreamClient, type ChatStreamRequest } from './chat-stream-client';
import {
  ChatStreamAbortedError,
  ChatStreamIdleTimeoutError,
  ChatStreamProtocolError,
  ChatStreamServerError,
} from './errors';
import { createManualTimers, replayTransport } from './stream-test-doubles';
import type { SseChunk, SseRequest, SseTransport } from './transport';

/** One turn, the shape every test sends. */
const REQUEST: ChatStreamRequest = {
  messages: [{ role: 'user', content: 'Who was Ruth?' }],
  useRag: true,
  webSearch: false,
};

/** A transport that never delivers a chunk and rejects only when its signal fires. */
function silentTransport(onAborted?: () => void): SseTransport {
  return {
    id: 'streaming-fetch',
    stream(request: SseRequest): Promise<void> {
      return new Promise((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => {
          onAborted?.();
          reject(new ChatStreamAbortedError());
        });
      });
    },
  };
}

describe('the chat stream client, failures', () => {
  it('throws a server error for an error frame, after delivering earlier deltas', async () => {
    const deltas: string[] = [];
    const replay = replayTransport([
      'data: {"delta": "partial"}\n\n',
      'data: {"error": "upstream refused"}\n\ndata: [DONE]\n\n',
    ]);
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000',
      transport: replay.transport,
    });

    const attempt = client.streamReply(REQUEST, { onDelta: (text) => deltas.push(text) });

    await expect(attempt).rejects.toBeInstanceOf(ChatStreamServerError);
    await expect(attempt).rejects.toMatchObject({ message: 'upstream refused' });
    expect(deltas).toEqual(['partial']);
  });

  it('throws a protocol error for a frame that is not valid JSON', async () => {
    const replay = replayTransport(['data: {"delta":\n\ndata: [DONE]\n\n']);
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000',
      transport: replay.transport,
    });

    await expect(client.streamReply(REQUEST, { onDelta: () => undefined })).rejects.toBeInstanceOf(
      ChatStreamProtocolError,
    );
  });

  it('lets a transport failure propagate unchanged', async () => {
    const transport: SseTransport = {
      id: 'streaming-fetch',
      stream: () => Promise.reject(new ChatStreamAbortedError()),
    };
    const client = createChatStreamClient({ baseUrl: 'http://localhost:8000', transport });

    await expect(client.streamReply(REQUEST, { onDelta: () => undefined })).rejects.toBeInstanceOf(
      ChatStreamAbortedError,
    );
  });

  it('prefers the server error over the abort it causes', async () => {
    // The client aborts the socket the moment an error frame lands. The reason the turn
    // failed is the server's message, not the cancellation that followed from it.
    const transport: SseTransport = {
      id: 'streaming-fetch',
      stream(_request: SseRequest, onChunk: (chunk: SseChunk) => void): Promise<void> {
        onChunk({
          encoding: 'bytes',
          bytes: new TextEncoder().encode('data: {"error":"boom"}\n\n'),
        });
        return Promise.reject(new ChatStreamAbortedError());
      },
    };
    const client = createChatStreamClient({ baseUrl: 'http://localhost:8000', transport });

    await expect(client.streamReply(REQUEST, { onDelta: () => undefined })).rejects.toBeInstanceOf(
      ChatStreamServerError,
    );
  });
});

describe('the chat stream client, idle timeout', () => {
  it('aborts and reports an idle timeout when the socket goes silent', async () => {
    const manual = createManualTimers();
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000',
      transport: silentTransport(),
      idleTimeoutMs: 5_000,
      timers: manual.timers,
    });

    const attempt = client.streamReply(REQUEST, { onDelta: () => undefined });
    manual.fire();

    await expect(attempt).rejects.toBeInstanceOf(ChatStreamIdleTimeoutError);
  });

  it('stops the watchdog once the stream completes', async () => {
    const manual = createManualTimers();
    const replay = replayTransport(['data: [DONE]\n\n']);
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000',
      transport: replay.transport,
      timers: manual.timers,
    });

    await client.streamReply(REQUEST, { onDelta: () => undefined });

    expect(manual.pending()).toBe(0);
  });

  it('never arms the watchdog when the budget is disabled', async () => {
    const manual = createManualTimers();
    const replay = replayTransport(['data: [DONE]\n\n']);
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000',
      transport: replay.transport,
      idleTimeoutMs: 0,
      timers: manual.timers,
    });

    await client.streamReply(REQUEST, { onDelta: () => undefined });

    expect(manual.pending()).toBe(0);
  });

  it('forwards the caller abort signal to the transport', async () => {
    const controller = new AbortController();
    const seen = vi.fn();
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000',
      transport: silentTransport(() => {
        seen();
      }),
    });

    const attempt = client.streamReply(REQUEST, { onDelta: () => undefined }, controller.signal);
    controller.abort();

    await expect(attempt).rejects.toBeInstanceOf(ChatStreamAbortedError);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
