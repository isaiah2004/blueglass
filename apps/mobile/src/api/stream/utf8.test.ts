/**
 * Tests for the incremental UTF-8 decoder.
 *
 * The only interesting question about this module is what happens at a chunk boundary,
 * so almost every test here splits a byte sequence somewhere it must not be split. The
 * "every split point" tests are the load-bearing ones: they assert the decoder is
 * boundary-independent, which is the property a network stream actually needs.
 */

import { describe, expect, it } from 'vitest';

import { decodeUtf8, EMPTY_UTF8_STATE, flushUtf8, type Utf8DecoderState } from './utf8';

/** U+FFFD, what the decoder emits for anything malformed. */
const REPLACEMENT = '�';

/** Decode a whole byte array in one call. */
function decodeWhole(bytes: Uint8Array): string {
  return decodeUtf8(EMPTY_UTF8_STATE, bytes).text;
}

/** Decode `bytes` as a sequence of chunks, concatenating the text produced. */
function decodeChunks(chunks: readonly Uint8Array[]): string {
  let state: Utf8DecoderState = EMPTY_UTF8_STATE;
  let text = '';
  for (const chunk of chunks) {
    const result = decodeUtf8(state, chunk);
    state = result.state;
    text += result.text;
  }
  return text + flushUtf8(state).text;
}

/** Split `bytes` at `at` and decode the two halves as separate chunks. */
function decodeSplitAt(bytes: Uint8Array, at: number): string {
  return decodeChunks([bytes.subarray(0, at), bytes.subarray(at)]);
}

describe('decodeUtf8', () => {
  it('decodes ASCII unchanged', () => {
    expect(decodeWhole(new TextEncoder().encode('data: {"delta":"Ruth "}'))).toBe(
      'data: {"delta":"Ruth "}',
    );
  });

  it('holds a two-byte character split across chunks', () => {
    // "é" is C3 A9. Split between them and a naive decoder emits two replacements.
    const bytes = new Uint8Array([0xc3, 0xa9]);
    expect(decodeSplitAt(bytes, 1)).toBe('é');
  });

  it('holds a three-byte character split after its lead byte', () => {
    // The em dash "—" is E2 80 94, and it is everywhere in generated prose.
    expect(decodeSplitAt(new Uint8Array([0xe2, 0x80, 0x94]), 1)).toBe('—');
  });

  it('holds a three-byte character split after two bytes', () => {
    expect(decodeSplitAt(new Uint8Array([0xe2, 0x80, 0x94]), 2)).toBe('—');
  });

  it('holds a four-byte character split at every boundary', () => {
    // U+1F54A DOVE, F0 9F 95 8A.
    const dove = new Uint8Array([0xf0, 0x9f, 0x95, 0x8a]);
    for (const at of [1, 2, 3]) {
      expect(decodeSplitAt(dove, at)).toBe('\u{1F54A}');
    }
  });

  it('decodes a mixed string identically at every possible split point', () => {
    const source = 'Ruth — “חֶסֶד” 🕊 loyal love, 忠実';
    const bytes = new TextEncoder().encode(source);
    for (let at = 0; at <= bytes.length; at += 1) {
      expect(decodeSplitAt(bytes, at)).toBe(source);
    }
  });

  it('decodes a mixed string identically when delivered one byte at a time', () => {
    const source = 'א 🕊 — ok';
    const bytes = new TextEncoder().encode(source);
    const singles = Array.from(bytes, (byte) => new Uint8Array([byte]));
    expect(decodeChunks(singles)).toBe(source);
  });

  it('replaces a byte that can never lead a sequence, then resynchronises', () => {
    expect(decodeWhole(new Uint8Array([0x41, 0xff, 0x42]))).toBe(`A${REPLACEMENT}B`);
  });

  it('replaces an overlong two-byte encoding of "/"', () => {
    // C0 AF is a classic filter-bypass encoding of "/". It must never decode.
    expect(decodeWhole(new Uint8Array([0xc0, 0xaf]))).toBe(`${REPLACEMENT}${REPLACEMENT}`);
  });

  it('replaces a UTF-16 surrogate half', () => {
    expect(decodeWhole(new Uint8Array([0xed, 0xa0, 0x80]))).toContain(REPLACEMENT);
    expect(decodeWhole(new Uint8Array([0xed, 0xa0, 0x80]))).not.toContain('\uD800');
  });

  it('replaces a code point above U+10FFFF', () => {
    expect(decodeWhole(new Uint8Array([0xf4, 0x90, 0x80, 0x80]))).toContain(REPLACEMENT);
  });

  it('resynchronises at the offending byte rather than skipping it', () => {
    // E2 opens a three-byte sequence; 0x41 is not a continuation, so "A" must survive.
    expect(decodeWhole(new Uint8Array([0xe2, 0x41]))).toBe(`${REPLACEMENT}A`);
  });

  it('reports an empty pending state when a chunk ends on a character boundary', () => {
    const result = decodeUtf8(EMPTY_UTF8_STATE, new TextEncoder().encode('ok'));
    expect(result.state.pending).toHaveLength(0);
  });

  it('carries exactly the unconsumed bytes forward', () => {
    const result = decodeUtf8(EMPTY_UTF8_STATE, new Uint8Array([0x41, 0xe2, 0x80]));
    expect(result.text).toBe('A');
    expect(result.state.pending).toEqual([0xe2, 0x80]);
  });
});

describe('flushUtf8', () => {
  it('emits nothing when the stream ended on a character boundary', () => {
    expect(flushUtf8(EMPTY_UTF8_STATE).text).toBe('');
  });

  it('emits one replacement when the stream ended mid-character', () => {
    const partial = decodeUtf8(EMPTY_UTF8_STATE, new Uint8Array([0xe2, 0x80]));
    expect(flushUtf8(partial.state).text).toBe(REPLACEMENT);
  });

  it('clears the pending bytes so the state can be reused', () => {
    const partial = decodeUtf8(EMPTY_UTF8_STATE, new Uint8Array([0xe2]));
    expect(flushUtf8(partial.state).state.pending).toHaveLength(0);
  });
});
