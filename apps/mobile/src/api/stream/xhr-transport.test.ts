/**
 * Tests for the `XMLHttpRequest` fallback transport.
 *
 * The request object is a double that reproduces the real lifecycle: `readyState` 3 fires
 * repeatedly with a growing `responseText`, then `readyState` 4 with a status. The point
 * of the tests is the cursor arithmetic — text already delivered must never be delivered
 * twice, which is the bug every hand-rolled version of this has shipped at least once.
 */

import { describe, expect, it } from 'vitest';

import { ChatStreamAbortedError, ChatStreamHttpError, ChatStreamTransportError } from './errors';
import type { SseChunk } from './transport';
import { createXhrTransport } from './xhr-transport';

/** A scriptable stand-in for the platform's `XMLHttpRequest`. */
class FakeXhr {
  readyState = 0;
  status = 0;
  responseText = '';
  responseType = '';
  onreadystatechange: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;

  readonly headers: Record<string, string> = {};
  method = '';
  url = '';
  sentBody: unknown = null;
  aborted = false;

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
    this.readyState = 1;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  send(body: unknown): void {
    this.sentBody = body;
  }

  abort(): void {
    this.aborted = true;
    this.readyState = 4;
    this.onabort?.();
  }

  /** Simulate more of the body arriving. */
  push(text: string): void {
    this.responseText += text;
    this.readyState = 3;
    this.onreadystatechange?.();
  }

  /** Simulate the response completing. */
  finish(status = 200): void {
    this.status = status;
    this.readyState = 4;
    this.onreadystatechange?.();
  }
}

/** Wire a fake into the transport and start a request. */
function start(): {
  fake: FakeXhr;
  chunks: SseChunk[];
  done: Promise<void>;
  controller: AbortController;
} {
  const fake = new FakeXhr();
  const chunks: SseChunk[] = [];
  const controller = new AbortController();
  const transport = createXhrTransport(() => fake as unknown as XMLHttpRequest);
  const done = transport.stream(
    {
      url: 'http://localhost:8000/chat/stream',
      body: '{"use_rag":true}',
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    },
    (chunk) => chunks.push(chunk),
  );
  return { fake, chunks, done, controller };
}

describe('createXhrTransport', () => {
  it('opens a POST with the caller headers and body', () => {
    const run = start();
    run.fake.finish();

    expect(run.fake.method).toBe('POST');
    expect(run.fake.url).toBe('http://localhost:8000/chat/stream');
    expect(run.fake.headers['Accept']).toBe('text/event-stream');
    expect(run.fake.sentBody).toBe('{"use_rag":true}');
    expect(run.fake.responseType).toBe('text');
    return run.done;
  });

  it('delivers only the newly arrived text on each progress event', async () => {
    const run = start();
    run.fake.push('data: {"delta":"Ruth "}\n\n');
    run.fake.push('data: {"delta":"is loyal."}\n\n');
    run.fake.finish();
    await run.done;

    expect(run.chunks).toEqual([
      { encoding: 'text', text: 'data: {"delta":"Ruth "}\n\n' },
      { encoding: 'text', text: 'data: {"delta":"is loyal."}\n\n' },
    ]);
  });

  it('ignores a progress event that added nothing', async () => {
    const run = start();
    run.fake.push('data: [DONE]\n\n');
    run.fake.push('');
    run.fake.finish();
    await run.done;

    expect(run.chunks).toHaveLength(1);
  });

  it('delivers the tail that only appeared at completion', async () => {
    const run = start();
    run.fake.responseText = 'data: [DONE]\n\n';
    run.fake.finish();
    await run.done;

    expect(run.chunks).toEqual([{ encoding: 'text', text: 'data: [DONE]\n\n' }]);
  });

  it('rejects a non-200 response with the body attached', async () => {
    const run = start();
    run.fake.responseText = '{"detail":"boom"}';
    run.fake.finish(500);

    await expect(run.done).rejects.toBeInstanceOf(ChatStreamHttpError);
  });

  it('treats a completion with status 0 as a connection failure, not an HTTP 0', async () => {
    const run = start();
    run.fake.finish(0);

    await expect(run.done).rejects.toBeInstanceOf(ChatStreamTransportError);
  });

  it('rejects with a transport error on a network failure', async () => {
    const run = start();
    run.fake.onerror?.();

    await expect(run.done).rejects.toBeInstanceOf(ChatStreamTransportError);
  });

  it('rejects with a transport error on a timeout', async () => {
    const run = start();
    run.fake.ontimeout?.();

    await expect(run.done).rejects.toBeInstanceOf(ChatStreamTransportError);
  });

  it('aborts the request and reports the abort when the signal fires', async () => {
    const run = start();
    run.controller.abort();

    await expect(run.done).rejects.toBeInstanceOf(ChatStreamAbortedError);
    expect(run.fake.aborted).toBe(true);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = createXhrTransport(() => new FakeXhr() as unknown as XMLHttpRequest);

    await expect(
      transport.stream(
        {
          url: 'http://localhost:8000/chat/stream',
          body: '{}',
          headers: {},
          signal: controller.signal,
        },
        () => undefined,
      ),
    ).rejects.toBeInstanceOf(ChatStreamAbortedError);
  });

  it('settles only once, even if the request completes after being aborted', async () => {
    const run = start();
    run.controller.abort();
    run.fake.finish(200);

    await expect(run.done).rejects.toBeInstanceOf(ChatStreamAbortedError);
  });
});
