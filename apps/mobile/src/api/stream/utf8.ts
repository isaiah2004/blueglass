/**
 * Incremental UTF-8 decoder, written as a pure reducer.
 *
 * Purpose
 *   A network chunk boundary can land in the middle of a multi-byte character. Decoding
 *   each chunk independently turns `“` (E2 80 9C) split as `E2 80` + `9C` into two
 *   replacement characters — a visible corruption in the middle of a streamed sentence.
 *   This module holds the incomplete trailing sequence back until the bytes that finish
 *   it arrive.
 *
 * Why not `TextDecoder` / `TextDecoderStream`
 *   `docs/architecture/flutter-port-map.md` risk #1 names the missing `TextDecoderStream`
 *   on Hermes. Expo SDK 57 does now install both in its "winter" runtime
 *   (`expo/build/winter/TextDecoderStream`), so the risk is softer than recorded — but a
 *   pure function that depends on no global is testable under plain Node, behaves
 *   identically on every engine, and cannot regress when a polyfill is dropped. That is
 *   worth eighty lines.
 *
 * Key responsibilities
 *   - Decode complete UTF-8 sequences to text.
 *   - Carry an incomplete trailing sequence (1-3 bytes) forward in the returned state.
 *   - Replace malformed bytes with U+FFFD and resynchronise, never throw.
 *
 * Usage
 *   ```ts
 *   let state = EMPTY_UTF8_STATE;
 *   for (const chunk of chunks) {
 *     const result = decodeUtf8(state, chunk);
 *     state = result.state;
 *     process(result.text);
 *   }
 *   ```
 */

/** Bytes of a sequence seen so far whose remaining bytes have not arrived yet. */
export interface Utf8DecoderState {
  /** At most three bytes. Empty when the last chunk ended on a character boundary. */
  readonly pending: readonly number[];
}

/** A decode step: the text produced, plus the state to feed the next chunk. */
export interface Utf8DecodeResult {
  readonly state: Utf8DecoderState;
  readonly text: string;
}

/** Starting state. Reuse freely — it is frozen and carries no per-stream identity. */
export const EMPTY_UTF8_STATE: Utf8DecoderState = Object.freeze({ pending: Object.freeze([]) });

/** U+FFFD REPLACEMENT CHARACTER, emitted for every malformed or truncated sequence. */
const REPLACEMENT = '\uFFFD';

/** Payload-bit masks for the lead byte of a 2-, 3- and 4-byte sequence. */
const LEAD_MASK: Readonly<Record<number, number>> = { 2: 0x1f, 3: 0x0f, 4: 0x07 };

/** Number of bytes in the sequence this lead byte opens; `0` when it cannot open one. */
function leadLength(lead: number): number {
  if (lead <= 0x7f) return 1;
  // 0xC0 and 0xC1 are excluded: they can only encode an overlong 2-byte form.
  if (lead >= 0xc2 && lead <= 0xdf) return 2;
  if (lead >= 0xe0 && lead <= 0xef) return 3;
  // 0xF5..0xFF would encode above U+10FFFF, which is not a code point.
  if (lead >= 0xf0 && lead <= 0xf4) return 4;
  return 0;
}

/**
 * Legal value range for the continuation byte at `offset` of a sequence opened by `lead`.
 *
 * The four special cases are the standard security constraints: they reject overlong
 * encodings (which let `/` be smuggled past a naive filter) and UTF-16 surrogate halves.
 */
function continuationRange(lead: number, offset: number): { min: number; max: number } {
  if (offset === 1) {
    if (lead === 0xe0) return { min: 0xa0, max: 0xbf };
    if (lead === 0xed) return { min: 0x80, max: 0x9f };
    if (lead === 0xf0) return { min: 0x90, max: 0xbf };
    if (lead === 0xf4) return { min: 0x80, max: 0x8f };
  }
  return { min: 0x80, max: 0xbf };
}

/** One decoded sequence: the text it produced and the index just past it. */
interface SequenceStep {
  readonly text: string;
  readonly next: number;
}

/**
 * Decode the single sequence starting at `start`.
 *
 * @returns The step, or `null` when the buffer ends mid-sequence and more bytes are needed.
 */
function decodeSequence(buffer: Uint8Array, start: number): SequenceStep | null {
  const lead = buffer[start];
  if (lead === undefined) return null;

  const length = leadLength(lead);
  if (length === 0) return { text: REPLACEMENT, next: start + 1 };
  if (length === 1) return { text: String.fromCharCode(lead), next: start + 1 };

  let codePoint = lead & (LEAD_MASK[length] ?? 0);
  for (let offset = 1; offset < length; offset += 1) {
    const byte = buffer[start + offset];
    if (byte === undefined) return null;
    const range = continuationRange(lead, offset);
    if (byte < range.min || byte > range.max) {
      // Resynchronise *at* the offending byte, not past it: it may itself be a valid lead.
      return { text: REPLACEMENT, next: start + offset };
    }
    codePoint = (codePoint << 6) | (byte & 0x3f);
  }
  return { text: String.fromCodePoint(codePoint), next: start + length };
}

/** Join carried-over bytes with the new chunk. Skipped entirely when nothing is pending. */
function withPending(pending: readonly number[], input: Uint8Array): Uint8Array {
  if (pending.length === 0) return input;
  const joined = new Uint8Array(pending.length + input.length);
  joined.set(pending, 0);
  joined.set(input, pending.length);
  return joined;
}

/**
 * Decode one chunk of bytes.
 *
 * @param state Result of the previous call, or {@link EMPTY_UTF8_STATE} to start.
 * @param input The bytes that just arrived. Never mutated.
 * @returns The text decoded so far and the state to pass to the next call.
 */
export function decodeUtf8(state: Utf8DecoderState, input: Uint8Array): Utf8DecodeResult {
  const buffer = withPending(state.pending, input);
  let text = '';
  let index = 0;

  while (index < buffer.length) {
    const step = decodeSequence(buffer, index);
    if (step === null) {
      return { state: { pending: Array.from(buffer.subarray(index)) }, text };
    }
    text += step.text;
    index = step.next;
  }

  return { state: EMPTY_UTF8_STATE, text };
}

/**
 * Close the decoder.
 *
 * @param state The final state.
 * @returns A single U+FFFD when the stream ended mid-character, otherwise the empty string.
 *          One replacement per truncated sequence, matching the WHATWG encoding standard.
 */
export function flushUtf8(state: Utf8DecoderState): Utf8DecodeResult {
  if (state.pending.length === 0) return { state: EMPTY_UTF8_STATE, text: '' };
  return { state: EMPTY_UTF8_STATE, text: REPLACEMENT };
}
