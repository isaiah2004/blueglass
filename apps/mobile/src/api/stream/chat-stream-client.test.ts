/**
 * Tests for the chat streaming client.
 *
 * The transport is faked so the chunk boundaries can be chosen deliberately; everything
 * above it — request shaping, parsing, event dispatch — is the real implementation.
 *
 * This file covers the happy path and the shape of the request that goes on the wire.
 * The failure paths live in `chat-stream-client.failures.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import type { ChatToolUse } from './chat-events';
import { createChatStreamClient, type ChatStreamRequest } from './chat-stream-client';
import { replayTransport } from './stream-test-doubles';
import type { SseRequest } from './transport';

/** One turn, the shape every test sends. */
const REQUEST: ChatStreamRequest = {
  messages: [{ role: 'user', content: 'Who was Ruth?' }],
  useRag: true,
  webSearch: false,
};

/** Collect the deltas and meta a stream produces. */
async function run(
  pieces: readonly string[],
): Promise<{ deltas: string[]; metas: ChatToolUse[]; requests: SseRequest[] }> {
  const deltas: string[] = [];
  const metas: ChatToolUse[] = [];
  const replay = replayTransport(pieces);
  const client = createChatStreamClient({
    baseUrl: 'http://localhost:8000',
    transport: replay.transport,
  });
  await client.streamReply(REQUEST, {
    onDelta: (text) => deltas.push(text),
    onMeta: (meta) => metas.push(meta),
  });
  return { deltas, metas, requests: replay.requests };
}

describe('the chat stream client, happy path', () => {
  it('delivers meta before the first delta, then every delta in order', async () => {
    const result = await run([
      'data: {"meta": {"rag": true, "web": false, "sources": ["Study notes"]}}\n\n',
      'data: {"delta": "Ruth "}\n\ndata: {"delta": "is loyal."}\n\n',
      'data: [DONE]\n\n',
    ]);

    expect(result.metas).toEqual([{ rag: true, web: false, sources: ['Study notes'] }]);
    expect(result.deltas).toEqual(['Ruth ', 'is loyal.']);
  });

  it('posts to /chat/stream with the server request schema', async () => {
    const result = await run(['data: [DONE]\n\n']);
    const request = result.requests[0];

    expect(request?.url).toBe('http://localhost:8000/chat/stream');
    expect(JSON.parse(request?.body ?? '{}') as unknown).toEqual({
      messages: [{ role: 'user', content: 'Who was Ruth?' }],
      use_rag: true,
      web_search: false,
    });
    expect(request?.headers['Content-Type']).toBe('application/json');
    expect(request?.headers['Accept']).toBe('text/event-stream');
  });

  it('tolerates a trailing slash on the configured base URL', async () => {
    const replay = replayTransport(['data: [DONE]\n\n']);
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000/',
      transport: replay.transport,
    });
    await client.streamReply(REQUEST, { onDelta: () => undefined });

    expect(replay.requests[0]?.url).toBe('http://localhost:8000/chat/stream');
  });

  it('carries the tools key on an assistant turn', async () => {
    const replay = replayTransport(['data: [DONE]\n\n']);
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000',
      transport: replay.transport,
    });
    await client.streamReply(
      {
        messages: [
          { role: 'user', content: 'hi' },
          {
            role: 'assistant',
            content: 'hello',
            tools: { rag: true, web: false, sources: ['Notes'] },
          },
        ],
        useRag: false,
        webSearch: false,
      },
      { onDelta: () => undefined },
    );

    expect(replay.requests[0]?.body).toContain('"tools"');
  });

  it('adds an Authorization header when a token is available', async () => {
    const replay = replayTransport(['data: [DONE]\n\n']);
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000',
      transport: replay.transport,
      authToken: () => 'session-token',
    });
    await client.streamReply(REQUEST, { onDelta: () => undefined });

    expect(replay.requests[0]?.headers['Authorization']).toBe('Bearer session-token');
  });

  it('omits the Authorization header while signed out', async () => {
    const replay = replayTransport(['data: [DONE]\n\n']);
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000',
      transport: replay.transport,
      authToken: () => null,
    });
    await client.streamReply(REQUEST, { onDelta: () => undefined });

    expect(replay.requests[0]?.headers['Authorization']).toBeUndefined();
  });

  it('works without an onMeta handler', async () => {
    const replay = replayTransport(['data: {"meta": {"rag": true}}\n\ndata: [DONE]\n\n']);
    const client = createChatStreamClient({
      baseUrl: 'http://localhost:8000',
      transport: replay.transport,
    });

    await expect(
      client.streamReply(REQUEST, { onDelta: () => undefined }),
    ).resolves.toBeUndefined();
  });
});
