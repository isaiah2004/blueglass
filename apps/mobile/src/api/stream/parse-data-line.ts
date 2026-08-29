/**
 * The `data:` line contract — one line in, one event out.
 *
 * Purpose
 *   This is the exact transcription of the Dart client's parser
 *   (`app/lib/services/chat_service.dart:78-101`) into a pure, total function. The server
 *   is real and already deployed, so every rule below is a fact about the wire, not a
 *   preference:
 *
 *   1. A line that does not start with `data:` is ignored — that covers blank separator
 *      lines and any `:heartbeat` comment a proxy injects.
 *   2. The payload is `line.slice(5)` then trimmed, so both `data:{...}` and
 *      `data:   {...}` parse.
 *   3. An empty payload is ignored.
 *   4. `[DONE]` ends the stream. Nothing after it is read.
 *   5. A non-null `error` key wins over everything else in the same frame.
 *   6. `meta` must be a JSON object; it yields exactly one tool-use event.
 *   7. `delta` must be a non-empty string. An empty delta is dropped, not rendered.
 *
 * Key responsibilities
 *   - Decide what a single SSE line means, with no state and no side effects.
 *   - Report unparseable frames as an event instead of throwing, so the caller chooses.
 */

import type { ChatStreamEvent, ChatToolUse } from './chat-events';

/** Every event line begins with this. Note: no trailing space — the server may omit it. */
export const SSE_DATA_PREFIX = 'data:';

/** The sentinel payload that terminates the stream. */
export const SSE_DONE_PAYLOAD = '[DONE]';

/** Narrow an unknown JSON value to a plain object. Arrays are excluded deliberately. */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Render any JSON value as a display string, the way Dart's `'$e'` interpolation would. */
function stringifyLoose(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value) ?? 'null';
}

/** Build a {@link ChatToolUse} defensively: absent or wrongly typed keys become defaults. */
function toToolUse(raw: Record<string, unknown>): ChatToolUse {
  const sources: string[] = [];
  const rawSources = raw['sources'];
  if (Array.isArray(rawSources)) {
    for (const entry of rawSources as readonly unknown[]) {
      sources.push(stringifyLoose(entry));
    }
  }
  return { rag: raw['rag'] === true, web: raw['web'] === true, sources };
}

/**
 * Interpret one already-split SSE line.
 *
 * @param line A single line with its terminator stripped. May be empty.
 * @returns The event the line represents, or `null` when the line carries no event
 *          (not a `data:` line, empty payload, or a frame with no recognised key).
 *          Never throws.
 */
export function parseSseDataLine(line: string): ChatStreamEvent | null {
  if (!line.startsWith(SSE_DATA_PREFIX)) return null;

  const payload = line.slice(SSE_DATA_PREFIX.length).trim();
  if (payload.length === 0) return null;
  if (payload === SSE_DONE_PAYLOAD) return { kind: 'done' };

  let decoded: unknown;
  try {
    decoded = JSON.parse(payload);
  } catch {
    // Not re-thrown: the parser stays total and the client decides whether a corrupt
    // frame is fatal. See `chat-stream-client.ts`, which raises ChatStreamProtocolError.
    return { kind: 'malformed', line };
  }
  if (!isJsonObject(decoded)) return { kind: 'malformed', line };

  const error = decoded['error'];
  if (error !== undefined && error !== null) {
    return { kind: 'error', message: stringifyLoose(error) };
  }

  const meta = decoded['meta'];
  if (isJsonObject(meta)) return { kind: 'meta', meta: toToolUse(meta) };

  const delta = decoded['delta'];
  if (typeof delta === 'string' && delta.length > 0) return { kind: 'delta', text: delta };

  return null;
}
