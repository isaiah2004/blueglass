/**
 * The chat SSE parser: bytes or text in, typed events out. Pure and transport-agnostic.
 *
 * Purpose
 *   Composes the three pure layers — UTF-8 decoding, line scanning, and the `data:` line
 *   contract — into one reducer with a single piece of carried state. Nothing here knows
 *   what a socket is, which is the point: the transport can be swapped (`expo/fetch`,
 *   `XMLHttpRequest`, a test double, a Node script) without touching a line of parsing.
 *
 * Key responsibilities
 *   - Accept a chunk as bytes (preferred) or as text, and emit the events it completes.
 *   - Survive a chunk boundary anywhere: mid-event, mid-`data:` line, mid-UTF-8 character.
 *   - Stop dead at `[DONE]` and ignore everything after it, exactly as the Dart client's
 *     `return` does (`chat_service.dart:84`).
 *
 * Why bytes are preferred over text
 *   Only a byte-level transport can guarantee the multi-byte fix in `utf8.ts` actually
 *   runs. React Native's `XMLHttpRequest` hands back already-decoded `responseText`, and
 *   its Android decoder can substitute U+FFFD before this module ever sees the data. That
 *   asymmetry is why `expo/fetch` is the primary transport — see `docs/architecture/spike-sse.md`.
 *
 * Usage
 *   ```ts
 *   let state = INITIAL_PARSER_STATE;
 *   for (const chunk of chunks) {
 *     const step = pushBytes(state, chunk);
 *     state = step.state;
 *     step.events.forEach(render);
 *   }
 *   finishStream(state).events.forEach(render);
 *   ```
 */

import type { ChatStreamEvent } from './chat-events';
import { EMPTY_LINE_SCAN_STATE, flushLines, scanLines, type LineScanState } from './line-scanner';
import { parseSseDataLine } from './parse-data-line';
import { decodeUtf8, EMPTY_UTF8_STATE, flushUtf8, type Utf8DecoderState } from './utf8';

/** Everything the parser carries between chunks. Treat as opaque; never mutate it. */
export interface ChatStreamParserState {
  /** Bytes of a character whose remaining bytes have not arrived. */
  readonly utf8: Utf8DecoderState;
  /** Text of a line whose terminator has not arrived. */
  readonly lines: LineScanState;
  /** Set once `[DONE]` has been seen. Every later chunk is discarded. */
  readonly finished: boolean;
}

/** One parse step. */
export interface ChatStreamParseResult {
  readonly state: ChatStreamParserState;
  readonly events: readonly ChatStreamEvent[];
}

/** Starting state for a new stream. */
export const INITIAL_PARSER_STATE: ChatStreamParserState = Object.freeze({
  utf8: EMPTY_UTF8_STATE,
  lines: EMPTY_LINE_SCAN_STATE,
  finished: false,
});

/** No events, state unchanged. Used for every chunk that arrives after `[DONE]`. */
function unchanged(state: ChatStreamParserState): ChatStreamParseResult {
  return { state, events: [] };
}

/** Turn whole lines into events, stopping at the first `done`. */
function eventsFromLines(lines: readonly string[]): {
  events: ChatStreamEvent[];
  finished: boolean;
} {
  const events: ChatStreamEvent[] = [];
  for (const line of lines) {
    const event = parseSseDataLine(line);
    if (event === null) continue;
    events.push(event);
    // `[DONE]` is terminal. Anything the server buffered after it is not ours to read.
    if (event.kind === 'done') return { events, finished: true };
  }
  return { events, finished: false };
}

/** Shared tail of {@link pushBytes} and {@link pushText}: scan lines, then interpret them. */
function consumeText(
  utf8: Utf8DecoderState,
  lines: LineScanState,
  text: string,
): ChatStreamParseResult {
  const scan = scanLines(lines, text);
  const decoded = eventsFromLines(scan.lines);
  return {
    state: { utf8, lines: scan.state, finished: decoded.finished },
    events: decoded.events,
  };
}

/**
 * Feed a chunk of raw bytes.
 *
 * @param state Previous state, or {@link INITIAL_PARSER_STATE}.
 * @param bytes The chunk exactly as the transport delivered it. Never mutated.
 * @returns The events this chunk completed and the state for the next one.
 */
export function pushBytes(state: ChatStreamParserState, bytes: Uint8Array): ChatStreamParseResult {
  if (state.finished) return unchanged(state);
  const decoded = decodeUtf8(state.utf8, bytes);
  return consumeText(decoded.state, state.lines, decoded.text);
}

/**
 * Feed a chunk of already-decoded text.
 *
 * Provided for the `XMLHttpRequest` fallback, which cannot hand over bytes. Prefer
 * {@link pushBytes}: this path trusts the platform's decoder at the chunk boundary.
 *
 * @param state Previous state, or {@link INITIAL_PARSER_STATE}.
 * @param text  The new text, i.e. `responseText.slice(alreadySeen)`.
 * @returns The events this chunk completed and the state for the next one.
 */
export function pushText(state: ChatStreamParserState, text: string): ChatStreamParseResult {
  if (state.finished) return unchanged(state);
  return consumeText(state.utf8, state.lines, text);
}

/**
 * Close the stream.
 *
 * Flushes a truncated character and an unterminated final line, so a server that closes
 * the socket without a trailing newline still delivers its last frame.
 *
 * @param state The final state.
 * @returns Any events recovered from the buffers, and a state marked finished.
 */
export function finishStream(state: ChatStreamParserState): ChatStreamParseResult {
  if (state.finished) return unchanged(state);

  const trailingText = flushUtf8(state.utf8).text;
  const scan = scanLines(state.lines, trailingText);
  const tail = flushLines(scan.state);
  const decoded = eventsFromLines([...scan.lines, ...tail.lines]);

  return {
    state: { utf8: EMPTY_UTF8_STATE, lines: EMPTY_LINE_SCAN_STATE, finished: true },
    events: decoded.events,
  };
}
