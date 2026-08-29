/**
 * The `/chat/stream` event vocabulary.
 *
 * Purpose
 *   One typed union for everything the grounded-chat SSE endpoint can say, so no consumer
 *   ever inspects a raw frame. This is the client half of a live contract with the FastAPI
 *   server (`server/app/routers/chat.py:141-162` in the Flutter prototype), transcribed in
 *   `docs/architecture/flutter-port-map.md` §5, endpoint 3.
 *
 * The wire, in order
 *   ```
 *   data: {"meta": {"rag": true, "web": false, "sources": ["Study notes — Matthew 2"]}}
 *   data: {"delta": "Ruth "}
 *   data: {"delta": "is David's "}
 *   data: [DONE]
 *   ```
 *   An error mid-stream arrives as `data: {"error": "..."}` followed by `[DONE]`.
 *
 * Key responsibilities
 *   - Name every event the stream can produce, including the two failure shapes.
 *   - Model the `meta` frame's payload exactly as the server sends it.
 *
 * Ordering guarantee worth preserving
 *   The server emits `meta` *before* it calls the model, which is why the tool chips
 *   ("Searched your library · 3 notes") appear instantly instead of after the first token
 *   (port map §7.1). Consumers must render `meta` the moment it lands.
 */

/** Which retrieval tools ran for this answer, and what they found. */
export interface ChatToolUse {
  /** Retrieval-augmented generation over the user's own library ran. */
  readonly rag: boolean;
  /** The provider's web-search plugin ran. */
  readonly web: boolean;
  /** Human-readable source labels, e.g. `"Study notes — Matthew 2"`. */
  readonly sources: readonly string[];
}

/**
 * One decoded event from the chat stream.
 *
 * `malformed` has no counterpart on the wire: it is what the parser reports instead of
 * throwing, so the parser can stay a total function. The client turns it into a
 * `ChatStreamProtocolError`, matching the Dart client, which lets `jsonDecode` throw.
 */
export type ChatStreamEvent =
  | { readonly kind: 'meta'; readonly meta: ChatToolUse }
  | { readonly kind: 'delta'; readonly text: string }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'done' }
  | { readonly kind: 'malformed'; readonly line: string };

/**
 * True when a `meta` frame reports nothing worth showing.
 *
 * Mirrors `ChatToolUse.isEmpty` in `chat_service.dart:30`. The tool-chip row renders
 * nothing at all in this case rather than an empty container.
 */
export function isToolUseEmpty(meta: ChatToolUse): boolean {
  return !meta.rag && !meta.web && meta.sources.length === 0;
}
