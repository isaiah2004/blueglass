/**
 * Tests for the incremental line scanner.
 *
 * Everything here is about a terminator that has not fully arrived yet. The CRLF cases
 * matter because the SSE endpoint sits behind whatever reverse proxy the deployment has,
 * and proxies rewrite line endings.
 */

import { describe, expect, it } from 'vitest';

import { EMPTY_LINE_SCAN_STATE, flushLines, scanLines, type LineScanState } from './line-scanner';

/** Feed chunks in order and collect every line produced, including the flushed tail. */
function scanAll(chunks: readonly string[]): string[] {
  let state: LineScanState = EMPTY_LINE_SCAN_STATE;
  const lines: string[] = [];
  for (const chunk of chunks) {
    const result = scanLines(state, chunk);
    state = result.state;
    lines.push(...result.lines);
  }
  lines.push(...flushLines(state).lines);
  return lines;
}

describe('scanLines', () => {
  it('splits on LF', () => {
    expect(scanAll(['a\nb\n'])).toEqual(['a', 'b']);
  });

  it('splits on CRLF and strips both characters', () => {
    expect(scanAll(['a\r\nb\r\n'])).toEqual(['a', 'b']);
  });

  it('splits on a lone CR', () => {
    expect(scanAll(['a\rb\r'])).toEqual(['a', 'b']);
  });

  it('emits an empty line for the blank separator between SSE events', () => {
    expect(scanAll(['data: 1\n\ndata: 2\n\n'])).toEqual(['data: 1', '', 'data: 2', '']);
  });

  it('withholds a line whose terminator has not arrived', () => {
    const result = scanLines(EMPTY_LINE_SCAN_STATE, 'data: {"delta":"Ru');
    expect(result.lines).toEqual([]);
    expect(result.state.pending).toBe('data: {"delta":"Ru');
  });

  it('joins a line split across three chunks', () => {
    expect(scanAll(['data: {"del', 'ta":"Ruth', ' "}\n'])).toEqual(['data: {"delta":"Ruth "}']);
  });

  it('withholds a trailing CR because the next chunk may open with LF', () => {
    const first = scanLines(EMPTY_LINE_SCAN_STATE, 'a\r');
    expect(first.lines).toEqual([]);
    const second = scanLines(first.state, '\nb\n');
    expect(second.lines).toEqual(['a', 'b']);
  });

  it('treats a withheld CR as its own terminator when the next chunk is not LF', () => {
    expect(scanAll(['a\r', 'b\n'])).toEqual(['a', 'b']);
  });

  it('is unaffected by an empty chunk', () => {
    expect(scanAll(['a', '', '\n'])).toEqual(['a']);
  });
});

describe('flushLines', () => {
  it('emits an unterminated final line', () => {
    expect(scanAll(['data: [DONE]'])).toEqual(['data: [DONE]']);
  });

  it('emits nothing when the stream ended on a terminator', () => {
    expect(flushLines({ pending: '' }).lines).toEqual([]);
  });

  it('drops a dangling CR rather than emitting an empty final line', () => {
    expect(flushLines({ pending: '\r' }).lines).toEqual([]);
  });
});
