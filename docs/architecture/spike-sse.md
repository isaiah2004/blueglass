# Spike — SSE streaming for grounded chat

**Status:** implemented, tested, and proven end-to-end against a local mock server.
**Code:** `apps/mobile/src/api/stream/`
**Answers:** `docs/architecture/flutter-port-map.md` risk #1 (SSE in React Native) and
risk #2 (per-token re-render cost).

Everything below was measured, not recalled. Commands to reproduce every number are in
§8. No call was made to OpenRouter and nothing was spent.

---

## 1 · The wire contract

`POST /chat/stream` on the FastAPI backend. Transcribed from
`server/app/routers/chat.py:141-162` and `app/lib/services/chat_service.dart:78-101` in
the read-only Flutter prototype, and cross-checked against port map §5, endpoint 3.

**Request**

```jsonc
{ "messages": [{ "role": "user" | "assistant", "content": "…", "tools": {…}? }],
  "use_rag": true, "web_search": false }
```

The full history goes up every turn — the server holds no session. `Content-Type:
application/json`, `Accept: text/event-stream`. The Flutter client sends **no**
`Authorization` header; ours sends one from day one (port map risk #9), which is why
`createChatStreamClient` takes an `authToken` supplier.

**Response** — `text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.

```
data: {"meta": {"rag": true, "web": false, "sources": ["Study notes — Matthew 2"]}}
data: {"delta": "Ruth "}
data: {"delta": "is David's "}
data: [DONE]
```

An error mid-stream is `data: {"error": "…"}` followed by `[DONE]`. Frames are separated
by a blank line, so the raw byte stream is `data: …\n\n`.

**The seven parser rules**, matched exactly (`parse-data-line.ts`, one named test each):

| # | Rule | Consequence if broken |
|---|---|---|
| 1 | Ignore any line not starting with `data:` | Proxy `: heartbeat` comments crash the turn |
| 2 | Payload is `line.slice(5)` then `.trim()` — no space assumed | `data:{…}` (no space) is dropped |
| 3 | Empty payload is ignored | Blank separator lines emit phantom events |
| 4 | `[DONE]` ends the stream; nothing after it is read | Buffered frames leak into the next turn |
| 5 | A non-null `error` key wins over everything in the same frame | A failed turn renders as text |
| 6 | `meta` must be a JSON object; it yields exactly one tool-use event | Tool chips never appear |
| 7 | `delta` must be a **non-empty** string | Empty deltas churn the render tree |

The `meta` frame is emitted *before* the model is called, which is why the tool chips feel
instant (port map §7.1). Any consumer that waits for the first token to render chrome
throws that away.

---

## 2 · Transport comparison

| Option | iOS | Android | Expo web | Delivers | New dependency | Verdict |
|---|---|---|---|---|---|---|
| **`expo/fetch`** (`expo` core, SDK 52+) | native, `response.body` is a `ReadableStream` | same | *is* `globalThis.fetch` | **bytes** | none — already in `expo@57.0.18` | **Chosen** |
| React Native's built-in `fetch` | buffers whole body | buffers whole body | streams | text, all at once | none | Unusable. XHR-backed; `response.body` is `null`. This is risk #1. |
| `react-native-sse` | yes (XHR) | yes (XHR) | no — would need the DOM `EventSource` | text | +1 package | Rejected. Same XHR limits as our own fallback, plus a second event vocabulary to adapt, plus no web story. |
| `XMLHttpRequest` + `onreadystatechange` | yes | yes | yes | **text** | none | **Implemented as the fallback** (`xhr-transport.ts`). |
| DOM `EventSource` | n/a | n/a | yes | text | none | Rejected outright: `GET` only, no request body, no custom headers. It cannot carry the message history or an auth token. |

### Why `expo/fetch` wins

1. **It is already installed.** SDK 57 ships it in `expo` core, so it works in Expo Go
   with no custom dev client and no new package. (Contrast `react-native-mmkv`, which the
   scaffold notes needs a dev client.)
2. **It delivers bytes.** `FetchResponse.body` is a real `ReadableStream<Uint8Array>`, so
   *our* decoder owns the UTF-8 chunk boundary. Every text-based transport hands that
   decision to the platform — see §5.
3. **One code path on all three platforms.** On web, `expo/fetch` resolves to
   `expo/build/winter/fetch/fetch.web` which is literally `globalThis.fetch`.
4. **It is structurally compatible with plain `fetch`.** `createStreamingFetchTransport`
   takes a `StreamingFetch` — a minimal structural type — and `expo/fetch` satisfies it
   **with no cast** (verified by `tsc`, `expo-fetch-transport.ts` is 8 lines of code). The
   same factory therefore runs against Node's global `fetch` in the tests and in the local
   harness, so the code proven end-to-end *is* the code that ships.

### Reversing the choice

`transport.ts` is the seam. `SseTransport.stream(request, onChunk)` — that is the whole
contract. Swapping the transport is one line at the composition root:

```ts
const transport = createExpoFetchTransport();   // or createXhrTransport()
const client = createChatStreamClient({ baseUrl, transport });
```

Nothing above the seam knows which one is in use. The parser accepts `bytes` **or**
`text` chunks precisely so a text-only transport can be dropped in without a second
parser.

---

## 3 · The parser contract

The parser is a **pure reducer**, not an object with a socket in it:

```ts
pushBytes(state, bytes) -> { state, events }
pushText (state, text)  -> { state, events }
finishStream(state)     -> { state, events }
```

No I/O, no timers, no globals, no mutation of the inputs. It is three composed layers,
each independently tested:

| Layer | File | Carries between chunks |
|---|---|---|
| UTF-8 decode | `utf8.ts` | up to 3 bytes of an unfinished character |
| Line scan | `line-scanner.ts` | text since the last terminator, including a dangling `\r` |
| Frame parse | `parse-data-line.ts` | nothing — it is a pure line → event function |

### Guarantees

- **Boundary independence.** The event sequence is identical however the bytes are cut.
  `chat-stream-parser.test.ts` proves this by replaying one transcript split at *every*
  byte position, one byte at a time, and at seven fixed chunk sizes.
- **No `TextDecoder` dependency.** Hermes historically lacked `TextDecoderStream`, which
  is what risk #1 records. **That note is now partly stale**: Expo SDK 57 installs both
  `TextDecoder` and `TextDecoderStream` in its winter runtime
  (`expo/build/winter/TextDecoderStream`). We still do not use them — a pure function
  behaves identically on every engine, runs under plain Node in tests, and cannot regress
  when a polyfill moves.
- **Malformed input never throws.** A corrupt frame becomes `{ kind: 'malformed' }`; the
  *client* decides it is fatal (matching Dart, where `jsonDecode` throws). Bad UTF-8
  becomes U+FFFD and the decoder resynchronises at the offending byte, so one bad byte
  costs one character, not the rest of the answer. Overlong encodings and UTF-16
  surrogate halves are rejected.
- **`[DONE]` is terminal.** Frames buffered behind it in the same chunk are discarded.

### Named tests for the cases that break naive parsers

`splits mid-event` · `splits mid-"data:" line: inside the prefix itself` ·
`splits mid-UTF8: inside the em dash of a delta payload` ·
`splits mid-UTF8: inside the four-byte dove emoji` (all three interior offsets) ·
`splits mid-CRLF when the server uses CRLF terminators` ·
`withholds a trailing CR because the next chunk may open with LF` ·
`ignores frames buffered behind [DONE] in the same chunk` ·
`delivers a final frame that arrived with no trailing newline`.

---

## 4 · Re-render strategy (risk #2)

The Flutter app calls `notifyListeners()` per delta and rebuilds its whole shell. React
cannot absorb that. Three mechanisms, in order of importance:

**1. The draft lives in its own store.** `chat-draft-store.ts` is a `zustand/vanilla`
store holding one in-flight reply. Nothing else in the app subscribes to it. The tab bar,
the reader, the message history and every layout component read from their own stores and
are untouched while a reply streams.

> **The rule:** no layout or shell component may subscribe to the draft store. Use the
> narrow hooks in `use-chat-draft.ts` (`useDraftText`, `useDraftStatus`, `useDraftMeta`,
> `useDraftError`) from the streaming bubble and its immediate children only. A component
> that selects the whole state object re-renders on every frame of every stream.

**2. Deltas are buffered outside the store and committed once per animation frame.**
`appendDelta` costs a string concat and a `schedule()`; no `set` happens until the frame
callback fires (`frame-throttle.ts`). Measured:

| Scenario | Tokens | Store commits | Ratio |
|---|---|---|---|
| Mock at 12 ms/token, Node, 16 ms frame budget | 8 | 7 | 1.1 : 1 |
| Mock burst, 400 tokens with no delay, Node | 400 | **1** | 400 : 1 |
| Mock burst, 400 tokens, Chrome + real `requestAnimationFrame` | 400 | **1** | 400 : 1 |

Coalescing only engages when tokens outrun the display, which is the correct behaviour:
a slow stream is committed promptly, a firehose is throttled. It degrades the right way
under load — a busy JS thread means fewer frames, which means harder coalescing.

**3. History is never mutated mid-stream.** `finish()` returns the final text for the
*conversation* store to append. A cancelled or failed turn therefore leaves no
half-message behind — the behaviour worth preserving from `state.dart:552-560`. `fail()`
keeps whatever text arrived and folds the un-committed buffer into the **same** state
update as the failure, so the end of a turn is exactly one render.

**Still to do when the bubble is built:** memoize the parsed Markdown AST on the draft
string (port map §7.1). The throttle bounds how often that parse runs; the memo stops it
running twice for the same text.

---

## 5 · Platform caveats

### Android

- **`expo/fetch` is not verified on a physical Android device or emulator.** No device,
  emulator or Android SDK is available in this environment. Everything below the transport
  seam is proven; the native `ExpoFetchModule` streaming path is not. Port map risk #1
  says "verify on a real Android device before building anything on top" — **that
  verification is still owed.** It is a five-minute check: run the mock server on the host,
  point the app at `http://10.0.2.2:8791`, watch tokens arrive.
- **Cleartext HTTP.** The prototype's default base URL is `http://10.0.2.2:8000` on
  Android. Release builds block cleartext by default; a debug/dev build permits it. The
  streaming endpoint must be HTTPS in production, or the stream fails to open at all with
  a bare transport error.
- **The XHR fallback decodes text on the platform's terms.** React Native's Android
  `XMLHttpRequest` builds `responseText` incrementally, and a chunk boundary inside a
  multi-byte character can be replaced with U+FFFD *before* our parser sees it. That
  corruption is permanent — no downstream code can recover the original character. This is
  the single strongest reason `expo/fetch` is primary. In the browser the same fallback is
  clean (verified in Chrome, §8), so the risk is specific to React Native's Android XHR.
- **Never gzip this route.** Adding `GZipMiddleware` to FastAPI would buffer the SSE
  response and destroy incremental delivery. The same applies to any reverse proxy —
  the server already sends `X-Accel-Buffering: no` for nginx; anything else in front of it
  needs its own buffering disabled.

### Backgrounding — a measured surprise

`requestAnimationFrame` **does not fire in a hidden browser tab.** Measured in Chrome: a
278 ms stream in a hidden tab produced **0** animation frames, so zero commits landed
during the stream and the whole reply appeared in one commit when `flush()` ran at the
end. Text was byte-perfect. This is correct — nothing was on screen to update — but two
things follow:

1. The end-of-stream path **must** fold the un-committed buffer in. `finish()` and
   `fail()` both do; a design that relied only on the frame callback would lose the tail.
2. React Native throttles timers and pauses the choreographer when the app is
   backgrounded, so expect the same behaviour on device. Do not build a "typing" animation
   that assumes a steady frame cadence.

The idle watchdog is a *silence* timeout, not a total one (60 s default,
`DEFAULT_IDLE_TIMEOUT_MS`) — a long grounded answer may legitimately stream for minutes.
A backgrounded app whose socket is also stalled will trip it; treat that as the retryable
case it is.

### Web

`expo/fetch` is `globalThis.fetch` on web, and both transports were exercised in real
Chrome against the mock server (§8). `expo export --platform web` succeeds. The stream
modules are not yet imported by any screen, so they are not in the current web bundle.

---

## 6 · Errors

Every failure is a typed `ChatStreamError` with a stable `code` (rule 6.1.3). No consumer
catches an `XMLHttpRequest` event or a raw `TypeError` (rule 6.2.4).

| Class | Code | Means | Retryable |
|---|---|---|---|
| `ChatStreamHttpError` | `STREAM_HTTP_ERROR` | non-200; body attached (FastAPI puts the reason there) | no — bug report |
| `ChatStreamServerError` | `STREAM_SERVER_ERROR` | a `data: {"error": …}` frame; partial text stays valid | yes |
| `ChatStreamTransportError` | `STREAM_TRANSPORT_ERROR` | connection failed or dropped mid-body | yes |
| `ChatStreamProtocolError` | `STREAM_PROTOCOL_ERROR` | a frame is not valid SSE JSON — server and client disagree | no — bug report |
| `ChatStreamAbortedError` | `STREAM_ABORTED` | the caller cancelled; render nothing | n/a |
| `ChatStreamIdleTimeoutError` | `STREAM_IDLE_TIMEOUT` | no chunk within the silence budget | yes |

A failure recorded from the stream body **wins** over the abort it causes: the client
cancels the socket the instant an `error` frame lands, and the caller still sees
`ChatStreamServerError`, not `ChatStreamAbortedError`.

There is **no retry and no resume.** `/chat/stream` is stateless and cannot continue a
partial completion, so "retry" always means a fresh model call against the budget. Whether
that happens automatically is queued as **`Q-022`**; the assumption in force is *keep the
partial text and show a Retry control* (`docs/decisions/ASSUMPTIONS.md`).

---

## 7 · File map

```
apps/mobile/src/api/stream/
├── index.ts                      public surface (does NOT re-export the Expo transport)
│
├── chat-events.ts                the event vocabulary: meta / delta / error / done / malformed
├── utf8.ts                       pure incremental UTF-8 decoder
├── line-scanner.ts               pure incremental line splitter (LF, CRLF, lone CR)
├── parse-data-line.ts            pure line → event; the seven rules of §1
├── chat-stream-parser.ts         the composed pure reducer
│
├── transport.ts                  the seam: SseRequest, SseChunk, SseTransport
├── streaming-fetch-transport.ts  any streaming fetch → bytes  (the real implementation)
├── expo-fetch-transport.ts       the only file that imports `expo/fetch`
├── xhr-transport.ts              XMLHttpRequest + responseText slicing (fallback)
│
├── chat-stream-client.ts         request shaping, auth header, dispatch, failure mapping
├── idle-watchdog.ts              silence timeout (rule 6.4.1)
│
├── frame-throttle.ts             one commit per animation frame
├── chat-draft-store.ts           the isolated draft store
├── use-chat-draft.ts             four narrow React hooks
│
├── stream-test-doubles.ts        shared fakes (not bundled — nothing ships imports it)
├── mock-sse-server.mjs           the local mock server; dev tool, never imported by app code
└── *.test.ts                     119 tests across 10 files
```

`index.ts` deliberately does **not** re-export `createExpoFetchTransport`: importing
`expo/fetch` drags in the React Native runtime and cannot load under Vitest. Application
code takes one extra import line; every other module stays testable in plain Node.

---

## 8 · Reproducing the proof

Zero network egress beyond `127.0.0.1`. No provider is contacted and nothing is spent.

**Unit and boundary tests** — 119 tests, ~0.7 s:

```bash
pnpm vitest run apps/mobile/src/api/stream
```

**The mock server** (`mock-sse-server.mjs`) writes each frame in **two TCP writes**, cut
six bytes from the end — which lands *inside* the em dash and *inside* the four-byte dove
emoji. A client that only works against tidy frames fails against it.

```bash
node apps/mobile/src/api/stream/mock-sse-server.mjs --port 8791
# POST /chat/stream         meta, 8 tokens, [DONE]
# POST /burst/chat/stream   400 tokens with no delay — exercises the throttle
# POST /error/chat/stream   tokens, then an error frame, then [DONE]
# POST /silent/chat/stream  headers only — exercises the idle timeout
```

**End-to-end, Node.** The client is TypeScript and the runner is plain Node, so compile
first (output goes to `node_modules/`, which is git-ignored):

```bash
npx tsc -p <tsconfig with outDir=node_modules/.spike-sse/out, module=commonjs>
node <runner>.cjs      # spawns the mock, runs 5 scenarios, kills the server
```

Observed (2026-08-29, Node v25.8.2):

```
== 1. normal stream ==     8 tokens / 7 commits / 292 ms
   final text: "Ruth is David's great-grandmother — see Ruth 4:17 🕊"
== 2. burst stream ==      400 tokens / 1 commit / 9 ms — 400:1 coalescing, no token lost
== 3. error frame ==       ChatStreamServerError STREAM_SERVER_ERROR "mock upstream refused"
                           partial text kept in full
== 4. idle timeout ==      ChatStreamIdleTimeoutError after 408 ms (budget 400 ms)
== 5. non-200 ==           ChatStreamHttpError status=404 body={"detail":"Not found"}
```

Both the em dash and the dove emoji were split across a real socket boundary and arrived
intact; the final text contains no U+FFFD.

**End-to-end, Chrome.** The compiled modules were bundled and run in a real browser
against the same mock (the mock sends permissive CORS headers, mirroring
`server/app/main.py:31`):

```
streaming-fetch  8 tokens → "Ruth is David's great-grandmother — see Ruth 4:17 🕊"
streaming-fetch  400 tokens / 1 rAF commit
xhr fallback     8 tokens → identical text (browser XHR decoding is clean)
errors           ChatStreamHttpError 404 · ChatStreamServerError "mock upstream refused"
rAF in a hidden tab: 0 frames in 278 ms — see §5
```

---

## 9 · What is not proven

| Gap | Why | Cost to close |
|---|---|---|
| **Android device / emulator** | none available in this environment | ~5 min once an emulator exists: point the app at the mock on `10.0.2.2:8791` |
| **iOS device** | same | same |
| **React Native component render counts** | the RN Vitest project is not wired (scaffold note: whoever writes the first component adds a `test.projects` entry). The store-level proof — one notification per frame, and a status-only subscriber untouched by 50 frames of text — is the mechanism underneath it | one component test alongside the streaming bubble |
| **The real FastAPI server** | not running here; the mock reproduces the documented wire format, not the server itself | one `docker compose up` and a re-run of the harness against port 8000 |
| **Markdown memoization** | belongs to the bubble, which does not exist yet | see §4 |
