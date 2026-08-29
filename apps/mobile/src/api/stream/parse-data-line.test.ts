/**
 * Tests for the `data:` line contract.
 *
 * Each case names a rule transcribed from `app/lib/services/chat_service.dart:78-101`.
 * If one of these fails, the Expo client and the deployed FastAPI server disagree about
 * the wire, which is a production bug, not a style question.
 */

import { describe, expect, it } from 'vitest';

import { parseSseDataLine } from './parse-data-line';

describe('parseSseDataLine', () => {
  it('ignores a line that does not start with "data:"', () => {
    expect(parseSseDataLine('event: message')).toBeNull();
    expect(parseSseDataLine('')).toBeNull();
  });

  it('ignores a proxy heartbeat comment', () => {
    expect(parseSseDataLine(': keep-alive')).toBeNull();
  });

  it('ignores a data line with an empty payload', () => {
    expect(parseSseDataLine('data:')).toBeNull();
    expect(parseSseDataLine('data:    ')).toBeNull();
  });

  it('accepts a payload with no space after the colon', () => {
    expect(parseSseDataLine('data:{"delta":"Ruth "}')).toEqual({ kind: 'delta', text: 'Ruth ' });
  });

  it('accepts a payload with extra whitespace after the colon', () => {
    expect(parseSseDataLine('data:    {"delta":"Ruth "}')).toEqual({
      kind: 'delta',
      text: 'Ruth ',
    });
  });

  it('reads the [DONE] sentinel', () => {
    expect(parseSseDataLine('data: [DONE]')).toEqual({ kind: 'done' });
  });

  it('reads the meta frame the server sends before the model is called', () => {
    const line = 'data: {"meta":{"rag":true,"web":false,"sources":["Study notes — Matthew 2"]}}';
    expect(parseSseDataLine(line)).toEqual({
      kind: 'meta',
      meta: { rag: true, web: false, sources: ['Study notes — Matthew 2'] },
    });
  });

  it('defaults every missing meta key rather than failing the stream', () => {
    expect(parseSseDataLine('data: {"meta":{}}')).toEqual({
      kind: 'meta',
      meta: { rag: false, web: false, sources: [] },
    });
  });

  it('coerces non-string meta sources to strings', () => {
    expect(parseSseDataLine('data: {"meta":{"sources":[1,null]}}')).toEqual({
      kind: 'meta',
      meta: { rag: false, web: false, sources: ['1', 'null'] },
    });
  });

  it('reads a delta frame', () => {
    expect(parseSseDataLine('data: {"delta":"is David\'s "}')).toEqual({
      kind: 'delta',
      text: "is David's ",
    });
  });

  it('drops an empty delta instead of rendering it', () => {
    expect(parseSseDataLine('data: {"delta":""}')).toBeNull();
  });

  it('drops a delta that is not a string', () => {
    expect(parseSseDataLine('data: {"delta":42}')).toBeNull();
  });

  it('reads an error frame', () => {
    expect(parseSseDataLine('data: {"error":"upstream refused"}')).toEqual({
      kind: 'error',
      message: 'upstream refused',
    });
  });

  it('lets an error key win over a delta in the same frame', () => {
    expect(parseSseDataLine('data: {"delta":"hi","error":"boom"}')).toEqual({
      kind: 'error',
      message: 'boom',
    });
  });

  it('treats a null error key as absent', () => {
    expect(parseSseDataLine('data: {"error":null,"delta":"hi"}')).toEqual({
      kind: 'delta',
      text: 'hi',
    });
  });

  it('reports unparseable JSON as malformed rather than throwing', () => {
    expect(parseSseDataLine('data: {"delta":')).toEqual({
      kind: 'malformed',
      line: 'data: {"delta":',
    });
  });

  it('reports a non-object payload as malformed', () => {
    expect(parseSseDataLine('data: [1,2,3]')).toEqual({ kind: 'malformed', line: 'data: [1,2,3]' });
  });

  it('ignores a well-formed frame with no recognised key', () => {
    expect(parseSseDataLine('data: {"ping":1}')).toBeNull();
  });
});
