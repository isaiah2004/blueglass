/**
 * Tests for the streaming `fetch` transport.
 *
 * These run against a real `ReadableStream`, the same object type `expo/fetch` hands back
 * on device and the browser hands back on Expo web. What is faked is only the network:
 * the reader, the chunk boundaries, and the error paths are genuine.
 */

import { describe, expect, it } from 'vitest';

import { ChatStreamAbortedError, ChatStreamHttpError, ChatStreamTransportError } from './errors';
import {
  createStreamingFetchTransport,
  type StreamingFetch,
  type StreamingFetchInit,
  type StreamingResponse,
} from './streaming-fetch-transport';
import type { SseChunk } from './transport';

/** A response whose body streams the given chunks and then closes. */
function streamingResponse(chunks: readonly Uint8Array[]): StreamingResponse {
  const body = new ReadableStream<Uint8Array>({
    start(controller): void {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return { ok: true, status: 200, body, text: () => Promise.resolve('') };
}

/**
 * A response whose body fails part-way through, the way a dropped socket does.
 *
 * The first chunk is delivered on the first `pull` and the failure on the second, because
 * `controller.error()` discards anything still queued — enqueueing and erroring in the
 * same tick would lose the chunk before the reader ever saw it.
 */
function failingResponse(message: string): StreamingResponse {
  let delivered = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller): void {
      if (!delivered) {
        delivered = true;
        controller.enqueue(new TextEncoder().encode('data: {"delta":"partial"}\n\n'));
        return;
      }
      controller.error(new Error(message));
    },
  });
  return { ok: true, status: 200, body, text: () => Promise.resolve('') };
}

/** Collect every chunk a transport delivers for one request. */
async function collect(
  fetchImpl: StreamingFetch,
  signal?: AbortSignal,
): Promise<{ chunks: SseChunk[] }> {
  const chunks: SseChunk[] = [];
  const transport = createStreamingFetchTransport(fetchImpl);
  await transport.stream(
    { url: 'http://localhost:8000/chat/stream', body: '{}', headers: {}, signal },
    (chunk) => chunks.push(chunk),
  );
  return { chunks };
}

describe('createStreamingFetchTransport', () => {
  it('delivers every chunk as bytes, in order', async () => {
    const encoder = new TextEncoder();
    const sent = [encoder.encode('data: {"del'), encoder.encode('ta":"Ruth "}\n\n')];
    const { chunks } = await collect(() => Promise.resolve(streamingResponse(sent)));

    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.encoding === 'bytes')).toBe(true);
  });

  it('drops zero-length chunks rather than churning the parser', async () => {
    const sent = [new Uint8Array(0), new TextEncoder().encode('data: [DONE]\n\n')];
    const { chunks } = await collect(() => Promise.resolve(streamingResponse(sent)));

    expect(chunks).toHaveLength(1);
  });

  it('sends a POST with the caller headers and body', async () => {
    const calls: { url: string; init: StreamingFetchInit }[] = [];
    const transport = createStreamingFetchTransport((url, init) => {
      calls.push({ url, init });
      return Promise.resolve(streamingResponse([]));
    });

    await transport.stream(
      {
        url: 'http://localhost:8000/chat/stream',
        body: '{"use_rag":true}',
        headers: { Accept: 'text/event-stream' },
      },
      () => undefined,
    );

    expect(calls).toHaveLength(1);
    const request = calls[0];
    expect(request?.url).toBe('http://localhost:8000/chat/stream');
    expect(request?.init.method).toBe('POST');
    expect(request?.init.body).toBe('{"use_rag":true}');
    expect(request?.init.headers).toEqual({ Accept: 'text/event-stream' });
  });

  it('rejects a non-200 response with the body attached', async () => {
    const response: StreamingResponse = {
      ok: false,
      status: 500,
      body: null,
      text: () => Promise.resolve('{"detail":"OPENROUTER_API_KEY is not configured."}'),
    };
    const attempt = collect(() => Promise.resolve(response));

    await expect(attempt).rejects.toBeInstanceOf(ChatStreamHttpError);
    await expect(attempt).rejects.toMatchObject({
      status: 500,
      body: '{"detail":"OPENROUTER_API_KEY is not configured."}',
    });
  });

  it('fails loudly when the platform returns a 200 with no readable body', async () => {
    // This is the shape React Native's built-in fetch produces: a whole-response buffer,
    // never a stream. Silently degrading to it would look like a hung reply.
    const response: StreamingResponse = {
      ok: true,
      status: 200,
      body: null,
      text: () => Promise.resolve(''),
    };
    await expect(collect(() => Promise.resolve(response))).rejects.toBeInstanceOf(
      ChatStreamTransportError,
    );
  });

  it('maps a connection failure to a transport error and keeps the cause', async () => {
    const attempt = collect(() => Promise.reject(new Error('Network request failed')));

    await expect(attempt).rejects.toBeInstanceOf(ChatStreamTransportError);
    await expect(attempt).rejects.toMatchObject({ code: 'STREAM_TRANSPORT_ERROR' });
  });

  it('maps a mid-body failure to a transport error after delivering what arrived', async () => {
    const chunks: SseChunk[] = [];
    const transport = createStreamingFetchTransport(() =>
      Promise.resolve(failingResponse('socket closed')),
    );
    const attempt = transport.stream(
      { url: 'http://localhost:8000/chat/stream', body: '{}', headers: {} },
      (chunk) => chunks.push(chunk),
    );

    await expect(attempt).rejects.toBeInstanceOf(ChatStreamTransportError);
    expect(chunks).toHaveLength(1);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      collect(() => Promise.resolve(streamingResponse([])), controller.signal),
    ).rejects.toBeInstanceOf(ChatStreamAbortedError);
  });

  it('reports a mid-body failure as an abort when the signal fired', async () => {
    const controller = new AbortController();
    const transport = createStreamingFetchTransport(() => {
      controller.abort();
      return Promise.resolve(failingResponse('aborted'));
    });

    const attempt = transport.stream(
      {
        url: 'http://localhost:8000/chat/stream',
        body: '{}',
        headers: {},
        signal: controller.signal,
      },
      () => undefined,
    );

    await expect(attempt).rejects.toBeInstanceOf(ChatStreamAbortedError);
  });
});
