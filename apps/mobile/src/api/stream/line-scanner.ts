/**
 * Incremental line scanner, written as a pure reducer.
 *
 * Purpose
 *   Server-Sent Events are line-oriented, but TCP is not. A chunk can end anywhere —
 *   halfway through `data: {"delta":` or between the `\r` and the `\n` of a CRLF. This
 *   module is the equivalent of Dart's `LineSplitter` from `chat_service.dart:75-77`:
 *   it emits only whole lines and carries the remainder forward.
 *
 * Key responsibilities
 *   - Split on LF, CRLF and lone CR, per the SSE specification.
 *   - Never emit a line until its terminator has actually been seen.
 *   - Hold a trailing `\r` back, because the `\n` that would complete a CRLF may be the
 *     first byte of the next chunk.
 *
 * What it deliberately does not do
 *   Interpret the lines. `parse-data-line.ts` owns the `data:` contract.
 */

/** Text seen since the last line terminator. */
export interface LineScanState {
  readonly pending: string;
}

/** A scan step: the whole lines produced, plus the state for the next chunk. */
export interface LineScanResult {
  readonly state: LineScanState;
  readonly lines: readonly string[];
}

/** Starting state. */
export const EMPTY_LINE_SCAN_STATE: LineScanState = Object.freeze({ pending: '' });

/**
 * Scan one chunk of text into whole lines.
 *
 * @param state Result of the previous call, or {@link EMPTY_LINE_SCAN_STATE} to start.
 * @param text  Newly decoded text. May be empty, may contain no terminator at all.
 * @returns The complete lines found (terminators stripped) and the carry-forward state.
 */
export function scanLines(state: LineScanState, text: string): LineScanResult {
  if (text.length === 0) return { state, lines: [] };

  const buffer = state.pending + text;
  const lines: string[] = [];
  let lineStart = 0;
  let index = 0;

  while (index < buffer.length) {
    const character = buffer[index];
    if (character === '\n') {
      lines.push(buffer.slice(lineStart, index));
      index += 1;
      lineStart = index;
      continue;
    }
    if (character === '\r') {
      // A `\r` in the final position is ambiguous: the next chunk may open with `\n`,
      // making it a CRLF. Stop here and carry the whole partial line, `\r` included.
      if (index === buffer.length - 1) break;
      lines.push(buffer.slice(lineStart, index));
      index += buffer[index + 1] === '\n' ? 2 : 1;
      lineStart = index;
      continue;
    }
    index += 1;
  }

  return { state: { pending: buffer.slice(lineStart) }, lines };
}

/**
 * Close the scanner at end of stream.
 *
 * @param state The final state.
 * @returns The unterminated remainder as one last line, or no lines when the stream ended
 *          cleanly on a terminator. A server that closes without a trailing newline still
 *          gets its last `data:` frame delivered.
 */
export function flushLines(state: LineScanState): LineScanResult {
  const remainder = state.pending.endsWith('\r') ? state.pending.slice(0, -1) : state.pending;
  if (remainder.length === 0) return { state: EMPTY_LINE_SCAN_STATE, lines: [] };
  return { state: EMPTY_LINE_SCAN_STATE, lines: [remainder] };
}
