/**
 * Tests for the composed chat SSE parser.
 *
 * These are the production cases. A naive parser passes every test in
 * `parse-data-line.test.ts` and still corrupts a real stream, because a real stream does
 * not arrive in frame-sized pieces. Every test below feeds the same known-good transcript
 * through a different, deliberately hostile chunking and asserts the events are identical.
 */

import { describe, expect, it } from 'vitest';

import type { ChatStreamEvent } from './chat-events';
import {
  finishStream,
  INITIAL_PARSER_STATE,
  pushBytes,
  pushText,
  type ChatStreamParserState,
} from './chat-stream-parser';

/** The exact transcript the FastAPI endpoint produces, em dash and all. */
const TRANSCRIPT =
  'data: {"meta": {"rag": true, "web": false, "sources": ["Study notes — Matthew 2"]}}\n\n' +
  'data: {"delta": "Ruth "}\n\n' +
  'data: {"delta": "is David\'s "}\n\n' +
  'data: {"delta": "great-grandmother — 🕊"}\n\n' +
  'data: [DONE]\n\n';

/** The events {@link TRANSCRIPT} must always produce, whatever the chunking. */
const EXPECTED: readonly ChatStreamEvent[] = [
  { kind: 'meta', meta: { rag: true, web: false, sources: ['Study notes — Matthew 2'] } },
  { kind: 'delta', text: 'Ruth ' },
  { kind: 'delta', text: "is David's " },
  { kind: 'delta', text: 'great-grandmother — 🕊' },
  { kind: 'done' },
];

/** Push byte chunks through the parser and collect every event, including the tail. */
function runBytes(chunks: readonly Uint8Array[]): ChatStreamEvent[] {
  let state: ChatStreamParserState = INITIAL_PARSER_STATE;
  const events: ChatStreamEvent[] = [];
  for (const chunk of chunks) {
    const step = pushBytes(state, chunk);
    state = step.state;
    events.push(...step.events);
  }
  events.push(...finishStream(state).events);
  return events;
}

/** Cut `bytes` into fixed-size pieces. */
function slice(bytes: Uint8Array, size: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let at = 0; at < bytes.length; at += size) {
    chunks.push(bytes.subarray(at, at + size));
  }
  return chunks;
}

const TRANSCRIPT_BYTES = new TextEncoder().encode(TRANSCRIPT);

describe('the chat stream parser, under hostile chunking', () => {
  it('parses the transcript delivered in one chunk', () => {
    expect(runBytes([TRANSCRIPT_BYTES])).toEqual(EXPECTED);
  });

  it('parses the transcript delivered one byte at a time', () => {
    const singles = Array.from(TRANSCRIPT_BYTES, (byte) => new Uint8Array([byte]));
    expect(runBytes(singles)).toEqual(EXPECTED);
  });

  it('parses the transcript split at every single position', () => {
    for (let at = 0; at <= TRANSCRIPT_BYTES.length; at += 1) {
      const chunks = [TRANSCRIPT_BYTES.subarray(0, at), TRANSCRIPT_BYTES.subarray(at)];
      expect(runBytes(chunks)).toEqual(EXPECTED);
    }
  });

  it('parses the transcript at several fixed chunk sizes', () => {
    for (const size of [1, 2, 3, 5, 7, 13, 64]) {
      expect(runBytes(slice(TRANSCRIPT_BYTES, size))).toEqual(EXPECTED);
    }
  });

  it('splits mid-event: between two data lines with no terminator yet', () => {
    const cut = TRANSCRIPT.indexOf('data: {"delta": "Ruth "}') + 10;
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode(TRANSCRIPT.slice(0, cut)),
      encoder.encode(TRANSCRIPT.slice(cut)),
    ];
    expect(runBytes(chunks)).toEqual(EXPECTED);
  });

  it('splits mid-"data:" line: inside the prefix itself', () => {
    // Cut between "da" and "ta:" — the prefix test must not run on a partial line.
    const cut = TRANSCRIPT.indexOf('data: {"delta": "Ruth "}') + 2;
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode(TRANSCRIPT.slice(0, cut)),
      encoder.encode(TRANSCRIPT.slice(cut)),
    ];
    expect(runBytes(chunks)).toEqual(EXPECTED);
  });

  it('splits mid-UTF8: inside the em dash of a delta payload', () => {
    // The em dash is E2 80 94; cut after its first byte, inside the JSON string.
    const emDashAt = TRANSCRIPT_BYTES.indexOf(0xe2, TRANSCRIPT.indexOf('great-grandmother'));
    expect(emDashAt).toBeGreaterThan(0);
    const chunks = [
      TRANSCRIPT_BYTES.subarray(0, emDashAt + 1),
      TRANSCRIPT_BYTES.subarray(emDashAt + 1),
    ];
    expect(runBytes(chunks)).toEqual(EXPECTED);
  });

  it('splits mid-UTF8: inside the four-byte dove emoji', () => {
    const doveAt = TRANSCRIPT_BYTES.indexOf(0xf0);
    expect(doveAt).toBeGreaterThan(0);
    for (const offset of [1, 2, 3]) {
      const chunks = [
        TRANSCRIPT_BYTES.subarray(0, doveAt + offset),
        TRANSCRIPT_BYTES.subarray(doveAt + offset),
      ];
      expect(runBytes(chunks)).toEqual(EXPECTED);
    }
  });

  it('splits mid-CRLF when the server uses CRLF terminators', () => {
    const crlf = new TextEncoder().encode(TRANSCRIPT.replaceAll('\n', '\r\n'));
    const cut = crlf.indexOf(0x0d);
    const chunks = [crlf.subarray(0, cut + 1), crlf.subarray(cut + 1)];
    expect(runBytes(chunks)).toEqual(EXPECTED);
  });
});

describe('the chat stream parser, termination', () => {
  it('ignores everything after [DONE]', () => {
    const encoder = new TextEncoder();
    const events = runBytes([
      encoder.encode('data: [DONE]\n\n'),
      encoder.encode('data: {"delta":"leaked"}\n\n'),
    ]);
    expect(events).toEqual([{ kind: 'done' }]);
  });

  it('ignores frames buffered behind [DONE] in the same chunk', () => {
    const events = runBytes([
      new TextEncoder().encode('data: [DONE]\n\ndata: {"delta":"leaked"}\n\n'),
    ]);
    expect(events).toEqual([{ kind: 'done' }]);
  });

  it('delivers a final frame that arrived with no trailing newline', () => {
    const events = runBytes([new TextEncoder().encode('data: {"delta":"tail"}')]);
    expect(events).toEqual([{ kind: 'delta', text: 'tail' }]);
  });

  it('emits nothing extra when finishing an already-finished stream', () => {
    const step = pushBytes(INITIAL_PARSER_STATE, new TextEncoder().encode('data: [DONE]\n\n'));
    expect(finishStream(step.state).events).toEqual([]);
  });

  it('reports a truncated multi-byte character at end of stream as malformed JSON', () => {
    // A stream cut mid-character inside a payload must not silently produce valid JSON.
    const truncated = new TextEncoder().encode('data: {"delta":"x—"}').subarray(0, 18);
    const events = runBytes([truncated]);
    expect(events).toEqual([{ kind: 'malformed', line: expect.any(String) as string }]);
  });
});

describe('the chat stream parser, text transport', () => {
  it('accepts already-decoded text for the XMLHttpRequest fallback', () => {
    let state: ChatStreamParserState = INITIAL_PARSER_STATE;
    const events: ChatStreamEvent[] = [];
    for (const piece of ['data: {"del', 'ta":"Ruth "}\n\ndata: [DO', 'NE]\n\n']) {
      const step = pushText(state, piece);
      state = step.state;
      events.push(...step.events);
    }
    expect(events).toEqual([{ kind: 'delta', text: 'Ruth ' }, { kind: 'done' }]);
  });

  it('reports an error frame and stops at the [DONE] that follows it', () => {
    const events = runBytes([
      new TextEncoder().encode('data: {"error": "upstream refused"}\n\ndata: [DONE]\n\n'),
    ]);
    expect(events).toEqual([{ kind: 'error', message: 'upstream refused' }, { kind: 'done' }]);
  });

  it('ignores blank separator lines and proxy heartbeats', () => {
    const events = runBytes([
      new TextEncoder().encode(': ping\n\ndata: {"delta":"a"}\n\n: ping\n\ndata: [DONE]\n\n'),
    ]);
    expect(events).toEqual([{ kind: 'delta', text: 'a' }, { kind: 'done' }]);
  });
});
