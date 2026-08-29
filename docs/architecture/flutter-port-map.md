# Flutter → Expo port map

Cartography of the Flutter prototype at `A:\Work\spark\spark-app\app\lib` (34 Dart files,
11 065 LOC) and its FastAPI backend at `A:\Work\spark\spark-app\server`.

**Source is READ-ONLY.** Every line reference below is `path/file.dart:line` relative to
`A:\Work\spark\spark-app\app\lib`, or `server/app/...` for the backend.

Read alongside `CLAUDE.md`. The provisional answer to `P-02` is *hybrid*: keep this app's
reader/chat **behaviour and quality bar**, let the PRD's screens and visual language win.
This document is the behaviour half of that trade.

---

## 1 · What this app actually is

**Nuhra** (Aramaic for "light") is a working, backend-connected Bible study reader — not a
mockup. A user opens it straight into a paper-toned reading canvas showing a real chapter
fetched live from Postgres (`GET /read/{book}/{chapter}`), currently seeded to their last
read position. They can jump to any of the 66 books and any chapter via a two-step
reference picker; chapters that carry LLM-generated study notes (Proverbs 1–10 and
Matthew 1–10 only, `data/books.dart:14`) are marked with a green dot. Tapping any verse
opens a verse panel with the chapter's study insight for that verse, live vote-ranked
cross-references from OpenBible, the original-language key words that occur in that verse,
and three actions: **Highlight** (optimistic toggle, persisted), **Add note** (free text,
persisted), **Ask** (jumps to the Ask page pre-seeded with a question about that verse).
Highlights render amber in the text, the open verse renders green, and a verse that is
both renders a third olive state (`screens/reader_screen.dart:294-338`). Full-text
scripture search runs in a popover *over* the reader so the reader never loses their
place, and results persist between openings.

Two AI surfaces exist. The **reader Chat panel** (right rail / bottom sheet) is
chapter-scoped: every question is silently prefixed with "I am reading {reference},
focused on verse N: '…'. Ground your answer in this passage." before being sent
(`state.dart:696-708`), and the conversation is persisted per chapter, so returning to
Proverbs 3 brings that chapter's conversation back. The standalone **Ask** page is a
general multi-turn conversation with a saved-thread sidebar (create / load / delete).
Both stream token-by-token over SSE from `POST /chat/stream`, both show which tools ran
(RAG retrieval / web search) as chips above the answer with the retrieved source labels,
and both render the reply as Markdown in which the model's `[[Book 3:16]]` references
become tappable pills that navigate the reader (`widgets/chat_markdown.dart:83-99`).
A **Library** lists every saved note and highlight; a **Sources & settings** page toggles
RAG grounding and web search as persisted preferences. Everything degrades gracefully: if
the backend is unreachable the reader falls back to a hand-authored Ruth 2 sample with a
richer, six-tab "wiki" context panel (entity pages, Hebrew interlinear, map, culture
article) that exists purely as an offline showcase and is never reachable when the backend
is up.

---

## 2 · Screen inventory

`Screen` enum: `today, read, ask, search, library, sources` (`state.dart:14`). Navigation
is a single enum field on a `ChangeNotifier`, not a router.

| Screen | Purpose | Key interactions | UX worth preserving | Expo route |
|---|---|---|---|---|
| **Today** (`screens/today_screen.dart`) | Phone home. Greeting + continue-reading + shortcuts. | Tap hero → reader at saved position; two quick-action cards (Ask, Library w/ live counts); three "enriched chapter" jump rows (Proverbs 1, Matthew 1, Search). | Hero card uses the chapter's `study.theme` as its blurb when study notes exist, else "Pick up where you left off in {book}" (`today_screen.dart:16-18`). `RiseIn` staggers cards in at `index × 55 ms`. | `app/(tabs)/index.tsx` |
| **Reader** (`screens/reader_screen.dart`, 894 L) | The product. Live scripture + study. | Tap title → reference picker; tap verse → verse panel; tap version pill → translation popover; word-study focus scrolls + chips the word inline; Original/Search pills (desktop only). | Constant-footprint verse rows (see §7.3). Measure caps at 520 dp tablet / 600 dp desktop, uncapped on phone (`:43-47`). Type scale 17/19/20 by breakpoint (`:37-41`). | `app/(tabs)/read.tsx` + `app/read/[book]/[chapter].tsx` |
| **Ask** (`screens/ask_screen.dart`) | General AI conversation with thread history. | Type → stream; three canned suggestion chips that also carry a demo artifact; toggle Sources/Web inline in the composer; sidebar New chat / load / delete thread. | Composer toggles sit *above* the input, always visible, and persist to the server. Scroll auto-pins only if already within 220 px of the bottom (`widgets/ask_view.dart:155-164`). | `app/(tabs)/ask.tsx` |
| **Search** (`screens/search_screen.dart`) | Full-screen scripture search. | Debounced at ≥3 chars; scope pills All / This book. | **Unreachable** — nothing calls `go(Screen.search)`. Superseded by `SearchOverlay`. Do not port; port the overlay. | — (drop) |
| **Library** (`screens/library_screen.dart`) | Saved notes + highlights. | Two count-bearing pills (Notes · n / Highlights · n); tap a card → opens that reference in the reader; ✕ deletes a note optimistically. | Card tap reuses `openHit(ScriptureHit(...))` so navigation is one code path (`:113-121`). | `app/(tabs)/library.tsx` |
| **Sources** (`screens/sources_screen.dart`) | Grounding + settings. | Toggle RAG, toggle web search (both persisted via `PUT /me/prefs`); read-only source list; read-only reading stats. | The two toggles are the *only* real settings; the "Enabled sources" list is hardcoded copy, not data (`:53-60`). | `app/settings/index.tsx` |
| **Sign-in** (`main.dart:186-229`) | Clerk prebuilt auth UI. | — | Gated off by default (`AppConfig.authEnabled` defaults `false`, `config.dart:16`) and impossible on web because `clerk_flutter` is a native SDK. | `app/(auth)/sign-in.tsx` |

**Overlays (not screens, but stateful surfaces):**

| Surface | Trigger | Notes |
|---|---|---|
| `SearchOverlay` (`widgets/search_overlay.dart`) | Rail/sidebar "Search", Today's search row | Floats over the reader; query + results live in `LampState` and survive close/reopen. Debounce ≥2 chars (`:43`). |
| `ContextPanel` (`widgets/context_panel.dart`, 2035 L) | Always present on tablet/desktop rail; bottom sheet on phone | Study ↔ Chat segmented switch + tab body + verse/entity overlay stack. |
| Reference picker (`widgets/reference_picker.dart`) | Tap the chapter title | Modal dialog, book grid → chapter grid. |
| Translation menu (`reader_screen.dart:699-847`) | Tap the version pill | Blurred popover anchored top-right, scale+fade in. |
| Phone context sheet (`app_shell.dart:105-185`) | `sheetOpen` on the read screen | 74 % height, drag handle, scrim, 340 ms `Cubic(.32,.72,0,1)` slide. |

---

## 3 · Component inventory (`widgets/`)

| Widget | What it does | Cx | Port strategy | RN equivalent / library |
|---|---|---|---|---|
| `atoms.dart` (324 L) | `RiseIn` (staggered fade+rise entrance), `MonoCaption` (uppercase tracked label), `Hatch`, `TinyProgress`, `PillToggle`, `Pill`, `AccentChip`, `cardDecoration()`, `SourceGlyph`. | S | **Direct** | Reanimated `FadeInDown` w/ `.delay(i*55)`; the rest are plain `View`/`Text` + tokens. `cardDecoration()` → a `styles.card` token object. |
| `glass.dart` (155 L) | `AppBackground` (paper + one static cross-hatch, in a `RepaintBoundary`), `Glass` (tint + optional backdrop blur + texture + border + shadow), `Pressable` (scale-to-0.96 on press). | M | **Rethink** | `Glass` → `expo-blur` `BlurView` **only** for transient overlays; for always-on chrome use a flat token colour (the Flutter code deliberately did the same — `glass.dart:37`). `Pressable` → RN `Pressable` + Reanimated `withTiming` scale. |
| `patterns.dart` (220 L) | Six procedural surface textures (`cross/dots/grid/scale/waves/hatch`) drawn as vectors, rasterised once into a seamless tile and repeated via `ImageShader` — O(1) per frame on resize. | L | **Drop or replace** | RN has no `CustomPainter`. Either ship pre-baked seamless PNG tiles as `ImageBackground` with `resizeMode:'repeat'`, or `react-native-svg` `<Pattern>`. The new design is dark/cinematic — most of this probably dies. Keep the *idea*: one cheap repeating texture per surface class. |
| `smooth_scroll.dart` (26 L) | `SmoothScrollView` — now a bare `SingleChildScrollView`. The `web_smooth_scroll` wheel-easing was **removed** because it fought trackpads (`:5-7`). | S | **Drop** | Plain `ScrollView`. **Do not reintroduce custom scroll easing** — this app already tried it and reverted. |
| `resizable_split.dart` (102 L) | Two-pane split with a draggable 11 px divider; tracks the *absolute pointer position*, not accumulated deltas, so the handle stays pinned under the cursor after clamping (`:44-50`). | M | **Drop (phone) / rethink (tablet)** | RN has no split pane. If needed: `react-native-gesture-handler` `Pan` + Reanimated shared value driving a `width` style. Copy the absolute-position trick verbatim; delta accumulation drifts. |
| `chat_markdown.dart` (205 L) | Markdown renderer with a custom inline syntax turning `[[John 3:16]]` into tappable green pills; `ToolUseChips` banner for RAG/web tool use. | M | **Rethink** | `react-native-markdown-display` or `marked` + custom renderer. The `[[…]]` rule is a *server-side prompt contract* (`server/app/routers/chat.py:35-40`) — keep it, it is far more robust than scanning prose for book names. |
| `wiki_text.dart` (175 L) | `WikiText` renders `[[id\|label]]` as dotted-underline tappable spans; `VerseText` renders the authored Ruth demo verses with styled/tappable runs. | M | **Port `WikiText`'s idea, drop `VerseText`** | Nested `<Text onPress>` inside a parent `<Text>` works in RN and keeps text flow. `VerseText` only serves the offline demo. |
| `context_panel.dart` (2035 L) | The whole right-hand surface: Study↔Chat switch, live-study tab bodies (Overview / Words / Commentary), verse detail overlay, entity wiki overlay, plus six authored Ruth-only tabs (Original / Culture / Map / Word). | L | **Split up + partially drop** | Must be broken into ≥8 files (300-line rule). Port `_RightPanelSwitch`, `_StudyOverview`, `_StudyWords`, `_StudyCommentary`, `_VerseView`, `_XrefCard`. Drop `_Original`, `_Culture`, `_MapTab`, `_Commentary`, `_Word`, `_EntityView`, `MapThumb`, `DottedCard` — all bound to the hardcoded Ruth 2 fixture. |
| `reader_chat.dart` (388 L) | Chapter-scoped chat panel: header w/ "Grounded in {ref}", empty-state suggestions, bubbles, streaming block, composer. | M | **Direct** | `FlatList`/`ScrollView` + Reanimated. Highest-value component in the file set. |
| `ask_view.dart` (623 L) | `Shimmer` (sweeping gradient), `Spinner`, `AskConversation` (scroll + pin), `_AskBubble`, `_AskStreaming`, `_Thinking`, `_ErrorCard`, `_InlineArtifact`, `_SourcesLine`, `_Composer`, `_Toggle`. | L | **Split + mostly direct** | `Shimmer` → `expo-linear-gradient` + Reanimated loop, or `react-native-skeleton-placeholder`. Split into ≥4 files. |
| `artifacts.dart` (263 L) | Three diagram renderers: vertical genealogy, horizontal + vertical timeline, comparison table. All bound to `data/content.dart` fixtures. | M | **Drop** | Nothing generates these at runtime — `_activeThread` only matches the three bundled demo threads (`screens/ask_screen.dart:164-169`). The PRD's badge sheets replace this concept entirely. |
| `reference_picker.dart` (353 L) | Modal: search field → OT/NT pills → 176 dp book tiles → 48×44 chapter tiles. Enriched books/chapters get a green dot/tint. | M | **Direct — port faithfully** | `@gorhom/bottom-sheet` or a full-screen modal route. Use `FlashList` for the 66-book grid. Note the deliberate **plain fade** transition: animating geometry over a blurred surface re-blurs every frame and stutters (`:24-28`). |
| `search_overlay.dart` (324 L) | Floating search over the reader: field w/ clear, scope pills, results with the query substring highlighted amber. | M | **Direct** | Modal + `FlashList`. |

---

## 4 · State & data flow

### How `state.dart` works

One class. `LampState extends ChangeNotifier` (`state.dart:29`), 821 lines, holding **every**
piece of state in the app — UI mode, reader content, study content, notes, highlights,
search, two independent chat conversations, prefs, and the user profile. It is handed to
the tree through `LampScope`, an `InheritedNotifier` (`state.dart:803-821`), with two
accessors:

- `LampScope.of(context)` — subscribes; the caller rebuilds on **every** `notifyListeners()`.
- `LampScope.read(context)` — does not subscribe.

`AppShell.build` calls `.of()` (`app_shell.dart:27`), so **every state change rebuilds the
entire shell**. During a streaming reply `notifyListeners()` fires once per SSE delta
(`state.dart:549`) — i.e. the whole app re-renders per token. Flutter's diffing absorbs it;
React will not. This is the single most important thing not to copy.

Two places already work around it: `_ReaderWithRail` keeps the drag width in a local
`ValueNotifier` and only commits to `LampState` on release (`app_shell.dart:344-398`), and
`ResizableSplit` keeps its width in local `setState`. Same reason.

**Cancellation.** Both chats use a monotonically increasing int token; after each `await`
the handler checks `if (token != _askToken) return;` (`state.dart:527, 542, 551, 572`). A
new question, a thread switch, or `dispose()` bumps the token and orphans the in-flight
stream. Port this — it is the correct pattern and RN needs it too (`AbortController`).

**Bootstrap sequence** (`state.dart:108-135`), all fire-and-forget with `catch (_) {}`:
`/me` (skipped if Clerk supplied the identity) → `/translations` → `/me/progress` →
`/me/prefs` → `notifyListeners()` → `loadChapter()` → *unawaited* `loadLibrary()` +
`loadAskHistory()`.

**Chapter load** (`state.dart:139-194`): clear everything → fetch verses → paint the reader
→ *then*, unawaited, fetch study / notes / highlights / saved chat. **The reader never
waits on enrichment.** Preserve this exactly.

### What is global vs local

| Global (in `LampState`) | Local (`setState` / controllers) |
|---|---|
| `screen`, `sheetOpen`, `menuOpen`, `searchOpen`, `tab`, `rightPanel`, `hebMode`, `entityStack` | Library tab index (`library_screen.dart:26`) |
| `book`, `chapter`, `version`, `translations`, `liveChapter`, `chapterStatus`, `chapterError` | "Add note" open/closed + its `TextEditingController` (`context_panel.dart:613-614`) |
| `study`, `studyLoading`, `studyError`, `focusedWord` | All text-field controllers and scroll controllers |
| `chapterNotes`, `highlights` (Set&lt;verseKey&gt;), `allNotes`, `allHighlights` | Reference-picker book/testament/filter state |
| `xrefOpen`, `xrefVerse`, `xrefStatus`, `xrefs`, `xrefError` | Split/rail drag widths (deliberately, for perf) |
| `searchQuery`, `searchResults`, `searchStatus`, `searchScopeBook` | Hover state on Ask history rows |
| `askMessages`, `askThreadId`, `asking`, `askDraft`, `askDraftTools`, `askError`, `askHistory`, `thread`, `askArtifact` | |
| `readerChat`, `readerChatBusy`, `readerChatDraft`, `readerChatDraftTools`, `readerChatError` | |
| `useRag`, `webSearch`, `verseSize`, `contextRailWidth`, `user` | |

### Recommended replacement shape

Split by lifetime and owner. Server-owned data goes to TanStack Query (cached, refetchable,
already has loading/error states — deleting `Loadable` and every `catch (_) {}`); only
genuinely client-owned state goes to Zustand; streaming drafts go to a dedicated store so
per-token updates cannot re-render the app.

```ts
// packages/state/src/reader.store.ts — client-owned reader UI
type ReaderStore = {
  book: string; chapter: number; translation: string;   // the route, mirrored from Expo Router params
  selectedVerseKey: number | null;                       // was xrefVerse/xrefOpen
  focusedWord: string | null;
  rightPanel: 'study' | 'chat';
  contextTab: 'overview' | 'words' | 'commentary';
  select(verseKey: number | null): void;
  focusWord(term: string | null): void;                  // toggles off if already focused
};

// packages/state/src/ui.store.ts — ephemeral chrome
type UiStore = {
  sheetOpen: boolean; searchOpen: boolean; translationMenuOpen: boolean;
  searchQuery: string; searchScopeBook: boolean;         // persist across open/close
};

// packages/state/src/prefs.store.ts — persisted (MMKV) + synced to PUT /me/prefs
type PrefsStore = { useRag: boolean; webSearch: boolean; verseSize: number };

// packages/state/src/chat.store.ts — streaming only; nothing else may subscribe
type ChatStore = {
  streams: Record<string, {                              // key: 'ask:<id>' | 'reader:<book>:<ch>'
    draft: string; tools: ToolUse | null; busy: boolean; error: string | null;
    abort: AbortController | null;
  }>;
  appendDelta(key: string, text: string): void;          // called per SSE event
  finish(key: string): void;
};
```

Server state → TanStack Query keys, replacing the hand-rolled loaders:

```
['chapter', translation, book, chapter]   ['study', book, chapter]
['xrefs', osisId]                          ['notes', book?, chapter?]
['highlights', book?, chapter?]            ['search', query, scopeBook]
['askThreads']                             ['askThread', id]
['readerChat', book, chapter]              ['translations']  ['progress']  ['me']
```

Mutations (`createNote`, `deleteNote`, `toggleHighlight`, `setProgress`, `setPrefs`,
`saveChat`, ask-thread CRUD) use optimistic updates — the Flutter code already does this by
hand for highlights (`state.dart:284-302`) and note deletion (`state.dart:275-282`).

**Subscribe with selectors.** `useChatStore(s => s.streams[key].draft)` in the bubble
component only. Never a whole-store subscription in a shell component.

---

## 5 · Service layer & API surface

Base URL from `config.dart:26-37`: `API_BASE_URL` dart-define if set, else
`http://10.0.2.2:8000` on Android (emulator → host) and `http://localhost:8000` everywhere
else. Port 8000, FastAPI, CORS `allow_credentials=False` (`server/app/main.py:31`).

**No authentication is sent on any request.** Every user endpoint is server-side scoped to
`STUB_USER = "dev-user"` (`server/app/routers/user.py:15-20`). Clerk, when enabled, only
supplies a display name to the client — its token never reaches the API. The Expo client
must add an `Authorization` header from day one and the server must grow a real
`current_user` dependency.

### `services/bible_api.dart` — reading

| # | Method / path | Request | Response | Stream |
|---|---|---|---|---|
| 1 | `GET /read/{book}/{chapter}?translation={code}` | `translation` defaults `KJVPCE`. `{book}` accepts canonical name, OSIS code, or alias — resolved by `book_number_from_any` (`server/app/scripture/books.py:40-63`), so `Proverbs`, `Prov`, `prov`, `1cor`, `sos` all work. | `{ reference: "Proverbs 1", translation: "KJVPCE", book_number: 20, chapter: 1, verses: [{ verse:int, text:string, osis_id:"Prov.1.1", verse_key:20001001 }] }` — 404 if book unknown or chapter empty. | no |
| 2 | `GET /verses/{osis}/cross-references?min_votes={n}&limit={n}` | `osis` = single OSIS point `John.3.16` (a trailing letter like `Gen.1.1a` is stripped). Client sends `min_votes=1`, `limit=50` (`bible_api.dart:67-71`). | `{ osis, from_key:int, cross_references: [{ ref:"1 John 4:9-10", osis:"1John.4.9", to_start_key:int, to_end_key:int, votes:int, text:string\|null }] }`. Ordered by votes desc. `text` is the KJVPCE text of the **start** verse only. The Dart model ignores `to_start_key`/`to_end_key` (`models/verse.dart:46-53`). | no |

`verse_key = book_number × 1 000 000 + chapter × 1 000 + verse`
(`server/app/scripture/refs.py:7-11`). John 3:16 → `43003016`. This is the app's universal
verse identity — highlights key off it, search returns it, cross-refs use it. **Adopt it
verbatim in the Expo client.**

### `services/chat_service.dart` — streaming chat

| # | Method / path | Request body | Response | Stream |
|---|---|---|---|---|
| 3 | `POST /chat/stream` | `{ "messages": [{"role":"user"\|"assistant", "content":string, "tools"?:object}], "use_rag": bool, "web_search": bool }` — the client sends the *full* history each turn (`chat_service.dart:64-68`). Server also accepts `model`, `rag_top_k` (default 4), `temperature` (default 0.7) (`server/app/schemas.py:10-19`); the Flutter client sends none of them. | `text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`. | **yes (SSE)** |

Wire format, in order (`server/app/routers/chat.py:141-162`):

```
data: {"meta": {"rag": true, "web": false, "sources": ["Study notes — Matthew 2"]}}
data: {"delta": "Ruth "}
data: {"delta": "is David's "}
...
data: [DONE]
```

An error mid-stream arrives as `data: {"error": "..."}` followed by `[DONE]`. The client
parser (`chat_service.dart:78-101`): split on newlines, keep lines starting `data:`, strip
the prefix and trim, `[DONE]` ends the stream, a `meta` object yields a one-off `ChatToolUse`,
a non-empty `delta` string yields a `ChatDelta`, an `error` key throws.

Notes for the port:
- The `meta` frame is emitted **before** the model is called, so tool chips appear
  immediately — that is why the "Reading your sources…" state looks instant.
- `messages` may carry a `tools` key on assistant turns; the server's Pydantic model
  (`ChatMessage`) has only `role` and `content`, so extra keys are dropped, not rejected.
- The system prompt (`chat.py:18-60`) is server-side and instructs the model to wrap every
  scripture reference in `[[ ]]`. The client's ref-pill parsing depends on it.
- `fetch` in React Native does **not** support streaming response bodies on all platforms.
  See §8, risk 1.

### `services/content_api.dart` — everything else

Generic helpers: `_get` throws `Exception('GET {path} failed ({code})')` on non-200
(`content_api.dart:17-23`); `_send` throws on `status >= 300` and tolerates an empty body
(`:25-38`). Every request is `Content-Type: application/json`, no auth header.

| # | Method / path | Request | Response | Called from |
|---|---|---|---|---|
| 4 | `GET /me` | — | `{ id, display_name, auth:"stub" }` | `_bootstrap`, only when Clerk gave no user (`state.dart:111-115`) |
| 5 | `GET /translations` | — | `{ translations: [{ code, name }] }` — only codes with verses loaded; `KJVPCE` sorted first. | `_bootstrap`; the translation popover |
| 6 | `GET /search/scripture?q={q}&limit={n}[&book={name}]` | `q` URL-encoded, `limit=50` from the client (server default 40, max 200), optional `book` name, server-side `translation` defaults `KJVPCE`. | `{ query, count, results: [{ ref:"Ruth 2:3", book_number, chapter, verse, text, osis_id, verse_key }] }` | `runSearch` (`state.dart:351-370`) |
| 7 | `GET /study/{book}/{chapter}` | — | `{ book_number, chapter, model, content:{…} }`. **404 = "no study content", handled as `null`, not an error** (`content_api.dart:69`). | `_loadChapterExtras` |
| 8 | `GET /me/notes[?book={n}&chapter={n}]` | Both params or neither (`content_api.dart:80`). `book` is a **number**. | `{ notes: [{ id, book_number, chapter, verse?, verse_key?, osis_id?, body, created_at }] }`, newest first | chapter load; `loadLibrary` |
| 9 | `POST /me/notes` | `{ book_number:int, chapter:int, verse:int\|null, verse_key:int\|null, osis_id:string\|null, body:string }` | the created note row | `addNote` |
| 10 | `DELETE /me/notes/{id}` | — | `{ ok: true }` | `deleteNote` (optimistic) |
| 11 | `GET /me/highlights[?book={n}&chapter={n}]` | as notes | `{ highlights: [{ verse_key, osis_id, book_number, chapter, verse, color }] }` | chapter load; `loadLibrary` |
| 12 | `POST /me/highlights` | `{ verse_key, osis_id, book_number, chapter, verse, color }` — `color` defaults `"amber"` client- and server-side | `{ highlighted: bool }` — **toggle**: existing row is deleted, keyed on `(user_id, verse_key)` alone | `toggleHighlight` (optimistic) |
| 13 | `GET /me/progress` | — | `{ book_number, chapter, updated_at }`, or `{ book_number: 20, chapter: 1 }` when unset | `_bootstrap` |
| 14 | `PUT /me/progress` | `{ book_number:int, chapter:int }` | `{ ok:true }` | `setReference`, fire-and-forget (`state.dart:201`) |
| 15 | `GET /me/prefs` | — | the raw prefs object, e.g. `{ rag:bool, web:bool, verseSize:number }` — **not** wrapped | `_bootstrap` |
| 16 | `PUT /me/prefs` | `{ "prefs": { rag, web, verseSize } }` — **is** wrapped (asymmetric with the GET) | `{ ok:true }` | `_savePrefs` |
| 17 | `GET /me/chats/{book}/{chapter}` | `{book}` is a URL-encoded **name**, resolved server-side | `{ messages: [{role, content, tools?}] }`, `[]` when absent or book unknown | chapter load — and only applied if a reply is not already streaming (`state.dart:191`) |
| 18 | `PUT /me/chats/{book}/{chapter}` | `{ "messages": [...] }` — full replace; `[]` clears | `{ ok:true }` | after each reader-chat turn; `clearReaderChat` |
| 19 | `GET /me/ask` | — | `{ threads: [{ id:int, title, updated_at }] }`, newest first | `loadAskHistory` |
| 20 | `GET /me/ask/{id}` | — | `{ messages: [...] }` | `loadAskThread` |
| 21 | `POST /me/ask` | `{ title:string, messages:[...] }` | `{ id:int }` | first persist of a new thread |
| 22 | `PUT /me/ask/{id}` | `{ title, messages }` — full replace | `{ ok:true }` | subsequent persists |
| 23 | `DELETE /me/ask/{id}` | — | `{ ok:true }` | `deleteAskThread` (optimistic) |

Thread titles are derived client-side: first user message, truncated to 56 chars + `…`
(`state.dart:583-590`).

### `StudyContent` shape (endpoint 7, the `content` object)

```jsonc
{
  "overview": "string",
  "theme": "string",
  "key_points": ["string"],
  "words": [{ "term": "wisdom", "original": "חָכְמָה", "translit": "ḥokmāh",
              "gloss": "skill for living", "note": "string" }],
  "culture": ["string"],
  "commentary": [{ "ref": "vv. 8-19", "note": "string" }],
  "verses": [{ "verse": 7, "note": "string", "cross_refs": ["Job 28:28"] }]
}
```

Parsed by `models/study.dart:78-92`. `isEmpty` is true when overview, words, commentary and
verses are *all* empty (`:68-69`) — a chapter with only a `theme` renders as "no study
notes". Note the snake_case/camelCase mix in the wire format (`key_points`, `cross_refs`,
`verse_key`, `book_number`, `osis_id`, `display_name` vs the client's `verseSize` inside
prefs). Generate TS types from FastAPI's OpenAPI schema rather than hand-writing them.

### Endpoints the Flutter client never calls

`GET /health`, `GET /study/available` (which `(book, chapter)` pairs have study content —
would replace the hardcoded `enrichedBooks = {20, 40}` in `data/books.dart:14`),
`PUT /study/{book}/{chapter}`, `POST /rag/ingest`, `POST /rag/search`.

**`GET /study/available` should be wired up in the port** — the reference picker's green
dots are currently a lie derived from a hardcoded set.

### `services/clerk_persistor.dart`

Two shims that exist only because `clerk_flutter`'s defaults use `path_provider`, which
throws on web: `PrefsPersistor` (session cache → a single JSON blob in
`shared_preferences`) and `NoopFileCache` (never caches avatars). **Both disappear in the
port** — Clerk's React Native SDK handles token storage itself. The lesson to carry over is
in `main.dart:50-53`: the native Clerk SDK authenticates with an `Authorization` header,
browsers force an `Origin` header, and Clerk rejects requests carrying both — so the same
auth path cannot serve native and web. Expo web will hit this.

---

## 6 · Design tokens extracted (`theme.dart`)

Colours were converted once from OKLCH to sRGB and frozen as constants, named
`g{L}_{C}` (green, hue 152) and `a{L}_{C}` (amber, hue 62), where `L` is lightness×100 and
`C` the chroma digits — `g52_09` is `oklch(0.52 0.09 152)` (`theme.dart:4-10`).

**The palette will not survive the move to a dark/cinematic design. The structure should.**
Four things are worth copying exactly: (a) a *named ramp* per hue rather than
`primary/secondary`, (b) alpha-bearing hairline/scrim tokens rather than opacity props,
(c) motion as three named durations + one curve, (d) a single `control` height that every
small button, tab and segment shares so unrelated control groups line up.

### Neutrals & surfaces

| Token | Value | Role |
|---|---|---|
| `canvas` | `#EDEAE3` | design-tool backdrop (unused in app) |
| `paper` | `#FBF9F5` | app surface |
| `card` / `glassCard` | `#FFFFFF` | cards |
| `glassCardSoft` | `#FAF8F3` | secondary card |
| `railBg` / `glassPanel` | `#F2EFE8` | chrome: rails, panels, nav, composer |
| `glassPanelStrong` | `#FBF9F5` | overlays, sheets, verse/entity panels |
| `contextBg` / `tintF7` | `#F7F5F0` | context surface, table head |
| `tint` | `#F4F1EA` | inset / code block |
| `clearPaper` | `#00FBF9F5` | *transparent paper* — fading an accent to this avoids the grey flash you get lerping through `transparent` (`theme.dart:42-44`). **Copy this trick.** |

### Ink ramp (13 steps, dark → light)

`ink #191815` · `ink900 #22201C` (scripture body) · `ink850 #26241F` · `ink800 #3B382F` ·
`ink700 #4A463E` · `ink600 #5A5648` · `ink500 #6F6A60` · `ink450 #7A7566` ·
`ink400 #7C7768` · `ink350 #8C8779` · `ink300 #9B9689` · `ink250 #A5A093` · `ink200 #B5B0A2`

### Lines, scrims, glass edges

| Token | Value | Alpha |
|---|---|---|
| `hairline` / `glassEdge` | `0x1A191815` | 10 % |
| `hairlineSoft` / `glassHairline` | `0x14191815` | 8 % |
| `glassEdgeSoft` | `0x12191815` | 7 % |
| `scrim` | `0x47191815` | 28 % |

### Green ramp (hue 152) — primary, "selected / live / affirmative"

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `g36_09` | `#074A24` | | `g78_09` | `#8BC89B` |
| `g40_09` | `#17552E` | | `g80_06` | `#A2C9AB` |
| `g42_09` | `#1E5B34` | | `g86_04` | `#BFD9C4` (accent border) |
| `g45_09` | `#28633C` | | `g88_03` | `#CADECE` |
| `g48_09` | `#316C44` | | `g93_035` | `#D8EFDD` |
| `g52_09` | `#3D784F` **primary** | | `g94_03` | `#DDF1E1` |
| `g58_09` | `#4F8A60` | | `g94_04` | `#D8F3DE` |
| `g62_09` | `#5A966B` | | `g95_03` | `#E0F5E5` |
| `g72_09` | `#79B589` | | `g96_02` | `#E8F6EB` · `g96_025 #E6F7EA` · `g97_02 #ECF9EF` |

### Amber ramp (hue 62) — "highlighted / historical / warning"

`a42_09 #6F400C` · `a44_09 #754614` · `a45_09 #784817` · `a48_09 #815121` ·
`a50_07 #805A38` · `a52_09 #8E5C2D` · `a62_09 #AD794B` · `a72_09 #CE9869` ·
`a92_05 #FEDEC3` (search-hit background) · `a93_035 #FAE3D1` · `a94_02 #F5E9DE` ·
`a94_025 #F8E8DB` · `a94_03 #FBE7D7` · `a94_04 #FFE6D1` (highlight fill) · `a96_02 #FCEFE5`

### Combo (highlighted **and** selected)

`combo96 #EFF1DA` (bg) · `combo55 #64702F` (accent bar) · `combo38 #474E22` (verse number).
A deliberate third olive state so two overlapping conditions read as their own thing rather
than one winning (`theme.dart:46-50`). **The new design needs an equivalent.**

### Typography

Three families via `google_fonts`, fetched at runtime.

| Helper | Family | Default size | Weight | Line-height | Default colour | Tracking |
|---|---|---|---|---|---|---|
| `LampType.serif` | Source Serif 4 | 16 | w400 | 1.25 | `ink` | — |
| `LampType.sans` | Instrument Sans | 13.5 | w400 | 1.40 | `ink800` | — |
| `LampType.mono` | **Instrument Sans** | 10.5 | w500 | 1.00 | `ink350` | `size × 0.11` |

`mono()` is a misnomer kept for call-site history — the app deliberately ships **no
monospace font** (`theme.dart:152-154`). It is the uppercase-tracked-label style. Rename it
`label` in the port.

Observed sizes in use: serif 30/26/25/24/23/22/21/20/18/17/16/15.5/15/14.5/14/13.5/13/12;
sans 15/14.5/14/13.5/13/12.5/12/11.5/11/10.5/10; label 13/11.5/11/10.5/10.
Scripture body is serif at 17 (phone) / 19 (tablet) / 20 (desktop), line-height **1.72**
(`screens/reader_screen.dart:37-41, 301`).

### Radius, control size, motion, breakpoints

| Group | Tokens |
|---|---|
| `LampRadius` | `sm 11` · `md 13` · `card 16` · `cardLg 20` · `chip 999` |
| `LampSize` | `control 30` — one height for header pills, panel tabs, and the Study/Chat switch (`theme.dart:174-180`) |
| `LampMotion` | `fast 240 ms` (highlights, pills, tab cross-fades) · `med 360 ms` (panels, menus, sheets) · `slow 520 ms` (large entrances) · `curve Cubic(.22, .9, .28, 1)` |
| Breakpoints | `phone < 600` · `tablet 600–1099` · `desktop ≥ 1100` (`theme.dart:204-210`) |

Timings that bypass the tokens (worth keeping as their own named tokens): sheet slide
340 ms `Cubic(.32,.72,0,1)`, sheet scrim 260 ms, nav item 220 ms, `Pressable` 120 ms,
`RiseIn` 460 ms with `index × 55 ms` stagger, `Shimmer` sweep 1250 ms, `Spinner` 1000 ms,
reference-picker fade 180 ms.

Ad-hoc alpha-black values appear inline in several places (`0x24191815`, `0x2E191815`,
`0x22191815`, `0x21191815`, `0x17191815`, `0x12191815`, `0x0B191815`, `0x09191815`,
`0x08191815`, `0x11191815`, `0x0D191815`, `0x14191815`, `0x29191815`, `0x1F191815`). In the
port these become a proper `alpha` scale — CLAUDE.md forbids inline raw colours.

---

## 7 · Behaviours worth preserving

The highest-value section. Each item is something a naive rewrite loses.

### 7.1 Streaming chat rendering

- **Tool chips arrive before the first token.** The server emits the `meta` frame before
  calling the model (`server/app/routers/chat.py:143-144`), so "Searched your library ·
  3 notes" appears instantly and the wait feels grounded rather than blank.
- **Draft is separate from history.** `askDraft` / `readerChatDraft` accumulate deltas; the
  finished text is appended to `askMessages` / `readerChat` only on completion
  (`state.dart:552-560`). History is never mutated mid-stream, so a cancelled or failed
  stream leaves no half-message.
- **Skeleton, then text.** While `draft.trim().isEmpty` the UI shows a spinner +
  "Reading your sources…" + three shimmer bars (and a 128 px block if an artifact is
  expected); the moment the first token lands it swaps to live Markdown
  (`widgets/ask_view.dart:313-316`, `353-383`). No layout jump.
- **Markdown is re-parsed on every delta.** Cheap in Flutter, expensive in React —
  memoize on the draft string and throttle to ~16–32 ms in the port.
- **Token-guarded cancellation.** See §4. Every `await` boundary re-checks the token.
- **Empty replies degrade.** If the stream yields nothing, the Ask page substitutes the
  canned `sample` answer for demo threads, else `"(no response)"` (`state.dart:552-553`).
- **Persist after, not during.** `_persistAskThread` / `_persistReaderChat` run in the
  `finally` block, unawaited (`state.dart:577, 743`).

### 7.2 Scroll behaviour

`smooth_scroll.dart` is the *negative* lesson: custom wheel easing was built, shipped, and
**removed** because it fought trackpads and felt laggy (`:5-7`). `scroll_animator` and
`web_smooth_scroll` are still in `pubspec.yaml` but imported nowhere. Do not add a scroll
physics library to the Expo app.

What is actually there and is worth keeping:

- **Conditional auto-pin.** Both chats scroll to the bottom on a new reply *only if the
  user is already near the bottom* — 220 px in Ask (`ask_view.dart:159`), 160 px in the
  reader chat (`reader_chat.dart:46`). Sending a message forces the pin (`force: true`).
  A reader who scrolled up to re-read is never yanked. This is three lines of code and it
  is the difference between a chat that feels considerate and one that feels hostile.
- **Scroll-to-focused-word.** Focusing a word study finds the first verse containing it,
  attaches a `GlobalKey` to that verse, and after the frame calls `Scrollable.ensureVisible`
  with `alignment: 0.18` — the word lands ~18 % down the viewport, not jammed at the top
  (`screens/reader_screen.dart:119-138`). Guarded by `_scrolledFor` so it fires once per
  focus change, not every rebuild. RN: `measureLayout` + `scrollTo`, or
  `FlashList.scrollToIndex({ viewPosition: 0.18 })`.

### 7.3 Verse selection & highlighting

The single most carefully built thing in the app (`screens/reader_screen.dart:277-383`).

- **Constant footprint.** Every verse *always* renders 11 px left padding and a 2.5 px left
  border bar. When unselected they are `clearPaper` (transparent paper). Selecting a verse
  changes only colours — the text never shifts sideways (`:346-352`). This is why selection
  feels like a light coming on rather than a layout reflow.
- **Three states, not two.** selected → green (`g97_02` bg / `g52_09` bar / `g52_09`
  number); highlighted → amber (`a94_04` / `a62_09` / `ink250`); **both** → olive
  (`combo96` / `combo55` / `combo38`). The verse number also gains weight `w600` when
  active (`:314`).
- **Fade through paper, never through grey.** The transparent state is
  `Color(0x00FBF9F5)` — transparent *paper*, not `Colors.transparent` (transparent black).
  Animating between them never passes through a muddy grey. RN: interpolate to
  `rgba(251,249,245,0)`, never `'transparent'`.
- **Optimistic highlight.** `toggleHighlight` mutates the local set and notifies *before*
  the POST, and swallows failure (`state.dart:284-302`). Feels instant.
- **Inline word chip.** When a word study is focused, every occurrence of the term in the
  verse becomes a dark rounded pill hugging the word, animating in with opacity 0→1 and
  scale 0.82→1 over 360 ms (`:361-419`). It is a `WidgetSpan` inside the text flow, so
  wrapping is unaffected. RN: nested `<Text>` with background + padding + `borderRadius`
  (iOS honours this on nested Text; **Android does not** — see §8, risk 4).
- **Selection also drives the chat.** With a verse open, the reader chat's grounding string
  narrows from "I am reading Proverbs 3" to "…focused on verse 5: '…'"
  (`state.dart:697-700`), and the panel header label changes to `Proverbs 3:5`
  (`state.dart:677-680`).

### 7.4 The context panel

- **Two surfaces behind one switch.** Study ↔ Chat is a segmented control at the top of the
  same rail, with the current reference right-aligned beside it
  (`widgets/context_panel.dart:85-169`). The reader never navigates away to ask a question.
- **Overlays stack over the panel, not over the reader.** The verse detail and the entity
  page render `Positioned.fill` above the tab body with an `AnimatedSwitcher` cross-fade,
  and are `IgnorePointer`-ed when closed (`:59-76`). The tab body's scroll position survives
  underneath.
- **Tab bodies cross-fade with a 2 % upward slide** keyed on the tab
  (`_FadingBody`, `:234-253`) — tab changes read as a soft replacement, not a snap.
- **Three empty states, distinguished.** Loading (spinner) / no content ("No study notes for
  this chapter yet" + which books *are* enriched) / genuine error (cloud-off icon, the
  message, and a Retry) — `:255-315`. A 404 from `/study` is explicitly **not** an error
  (`services/content_api.dart:69`). Most rewrites collapse these three into one.
- **The verse panel is a complete workspace,** in this order: verse text → action chips
  (Highlight / Add note / Ask) → inline note composer → study note + its cross-ref chips →
  original-language words that occur *in this verse* → your notes → live cross-references
  with their own loading/error/empty/retry (`:733-963`). Cross-ref chips parse
  `^(.+?)\s+(\d+)` and navigate (`:650-669`).
- **Word study ↔ text is bidirectional.** Tapping a word card scrolls the reader to it and
  chips it inline; tapping again unfocuses (`state.dart:435-438` — toggle semantics).
  The card shows an "In the text" badge while active (`:527-548`).
- **Phone parity.** The identical `ContextPanel` renders inside the bottom sheet
  (`app_shell.dart:173`); only the tab strip location differs (`showTabs`).

### 7.5 Markdown rendering

- **`[[Book Chapter:Verse]]` → tappable pill** via a custom inline syntax
  (`widgets/chat_markdown.dart:83-99`). Regex `\[\[\s*([^\[\]]+?)\s*\]\]`, then
  `^(.*?)\s+(\d+)(?::(\d+))?` splits book / chapter / verse; the pill navigates to
  `book, chapter` and switches to the reader. Chapter defaults to `1` if unparseable.
- **This is a prompt contract, not a text scan.** The server prompt mandates the brackets
  (`server/app/routers/chat.py:35-40`), so the client never has to guess whether "James"
  is a book or a name. Keep both halves.
- **A full stylesheet, not defaults.** Headings in serif, body in sans at 1.6, links in
  `g45_09` w600, blockquotes with a 3 px `g80_06` left rule, code blocks on `tint` at
  radius 10, `blockSpacing: 10`, `listIndent: 20`, `pPadding: zero`
  (`chat_markdown.dart:44-78`). Two body sizes: 14.5 on Ask, 13.5 in the reader chat.
- **`ToolUseChips`** renders differently for "found notes" (green, "Searched your library ·
  3 notes" + the source labels joined by `·`, max 2 lines) vs "RAG on but nothing matched"
  (neutral, "No matching notes — from Scripture") vs web ("Searched the web", amber)
  (`:149-205`). That middle state is honest about retrieval failing and is exactly what
  pillar 3 (zero-hallucination) needs.

### 7.6 The reference picker

- **Two steps, not a wheel.** Search field → OT/NT pills → 176 dp book tiles showing the
  chapter count → a grid of 48×44 chapter tiles. Enter on the search field jumps straight to
  the first match (`widgets/reference_picker.dart:189-192`).
- **Search normalises away spaces**, so `1cor`, `1 Cor`, `songofsongs` all hit
  (`:69-72`, and `data/books.dart:85-97`).
- **Enrichment is visible before you commit.** Books with study content get a green dot and
  a green border; enriched chapters get a green fill, with a legend
  ("Green = chapters with study notes") above the grid (`:295-310`). The reader can see
  where the depth is *before* navigating. Currently driven by the hardcoded
  `enrichedBooks = {20, 40}` and `chapter <= 10` (`:32-33`) — wire to `GET /study/available`.
- **Deliberate plain fade.** No scale/slide, because animating geometry over a
  `BackdropFilter` re-blurs every frame and stutters on web (`:24-28`). The same note
  appears in the translation menu. Carry this constraint to `expo-blur`.

### 7.7 Other things that would be quietly lost

- **The reader paints before enrichment lands.** `loadChapter` shows verses the moment they
  arrive, then fires study / notes / highlights / saved-chat in the background
  (`state.dart:152-165`).
- **Every user-data failure is silent.** Notes, highlights, progress and prefs all
  `catch (_) {}` — a dead backend never blocks reading. (The port should log these rather
  than swallow them; CLAUDE.md forbids empty catch blocks. Keep the *behaviour*, add
  observability.)
- **Friendly network errors.** `SocketException` / `Connection refused` /
  `Failed host lookup` / `ClientException` all collapse to "Can't reach the backend."
  (`state.dart:781-790`).
- **Saved chat does not clobber a live one.** The per-chapter chat is only applied if
  `!readerChatBusy` (`state.dart:191`).
- **Search state is sticky.** Query, results and scope survive closing the overlay
  (`state.dart:326-337`).
- **Cross-fade between phone screens.** `AnimatedSwitcher` 360 ms keyed on `screen`
  (`app_shell.dart:87-94`) — tab changes dissolve rather than cut.
- **Press feedback everywhere.** `Pressable` scales to 0.96 over 120 ms; Material splash and
  highlight are globally disabled (`main.dart:25-26`) in favour of it.
- **Web text selection.** The whole shell is wrapped in `SelectionArea` so canvas-rendered
  text is drag-selectable (`app_shell.dart:46`). Irrelevant on native, relevant for Expo web.
- **Rail width is committed on release, not during drag** (`app_shell.dart:344-398`).

---

## 8 · Port risks, ranked

| # | Risk | Why it is hard | Mitigation |
|---|---|---|---|
| 1 | **SSE streaming in React Native** | RN's `fetch` (XHR-backed) does not expose `response.body` as a readable stream on Android, and Hermes has no `TextDecoderStream`. Dart's `client.send()` + `utf8.decoder` + `LineSplitter` has no direct equivalent. | Use `react-native-sse` or `expo/fetch` (`expo/fetch`'s streaming `fetch` supports `response.body` on both platforms in SDK 52+). Verify on a real Android device before building anything on top. Fallback: `XMLHttpRequest` with `onprogress` and manual `responseText.slice(lastIndex)` — ugly but universally supported. Keep the parser (`data:` prefix, `[DONE]`, `meta`/`delta`/`error`) identical to `chat_service.dart:78-101`. |
| 2 | **Per-token re-render cost** | The Flutter app calls `notifyListeners()` per SSE delta and rebuilds the entire shell. React cannot absorb that: a long reply is hundreds of renders of a Markdown tree. | Isolate the draft in its own Zustand store keyed by conversation; only the streaming bubble subscribes. Throttle `appendDelta` to one commit per animation frame. Memoize the parsed Markdown AST on the draft string. Never let a layout/shell component subscribe to draft state. |
| 3 | **`context_panel.dart` is 2035 lines and CLAUDE.md caps files at 300** | It contains ~20 components across two entirely different content models (live study vs the authored Ruth fixture). | Drop the Ruth fixture path (~900 lines, §3). Split the rest into `context/PanelSwitch`, `context/StudyTabs`, `context/StudyOverview`, `context/StudyWords`, `context/StudyCommentary`, `context/VersePanel`, `context/VerseActions`, `context/CrossRefList`, `context/EmptyStates`. |
| 4 | **Inline styled spans inside flowing text** | Three features depend on it: the inline word-study chip, the `[[ref]]` pill, and search-hit background highlighting. Android's nested `<Text>` ignores `borderRadius` and padding is unreliable; `backgroundColor` works but boxes are square. | Nested `<Text>` with `backgroundColor` for search hits (square is acceptable). For pills that must be rounded, use `<Text>` containing a `<View>` only where the design tolerates the baseline shift, or accept squared corners on Android, or render the pill as a separate line-broken element. Prototype this early — it is the most likely place the design has to bend. |
| 5 | **No split pane / draggable divider in RN** | Desktop Ask and the reader rail both need one; `resizable_split.dart`'s absolute-pointer tracking is non-trivial. | If Q-006 resolves phone-only, this evaporates. Otherwise: `react-native-gesture-handler` `Pan` + a Reanimated shared value driving `width`, and copy the absolute-position technique (`resizable_split.dart:44-50`) — delta accumulation drifts at the clamps. |
| 6 | **Procedural textures** | `patterns.dart` draws six textures as vectors and caches them as `ImageShader` tiles. RN has no `CustomPainter` and `react-native-svg` `<Pattern>` is slow at full-screen size. | Pre-bake seamless PNG tiles at build time and repeat them (`ImageBackground` + `resizeMode:'repeat'`, or a `expo-image` with `tintColor`). Or drop textures entirely — the new dark design may not want them. |
| 7 | **Backdrop blur cost** | Four surfaces use `BackdropFilter` (translation menu, reference picker, search overlay, phone sheet). `expo-blur` on Android is materially more expensive than on iOS, and the Flutter code already found that *animating geometry over a blur re-blurs every frame*. | Restrict blur to transient overlays only (the Flutter code already documents this rule, `glass.dart:37`). Never animate a blurred surface's size or scale — fade only. Consider a flat translucent fill on Android. |
| 8 | **Fonts** | `google_fonts` fetches Source Serif 4 / Instrument Sans at runtime with a graceful offline fallback. Expo bundles fonts instead. | `expo-font` + `useFonts`, with the families vendored into `assets/fonts`. Budget the bundle size; the scripture serif needs at least 400/600. Splash must hold until fonts load or scripture will reflow on first paint. |
| 9 | **Auth is not actually wired** | The client sends no `Authorization` header; the server hardcodes `dev-user`. Clerk only supplies a display name. And the native-SDK/`Origin`-header conflict (`main.dart:50-53`) will recur on Expo web. | Do auth properly from the start: Clerk Expo SDK → `getToken()` → an axios/fetch interceptor → a FastAPI `current_user` dependency that verifies the JWT. Do not port the stub. Test Expo web early. |
| 10 | **Book-name ↔ number mapping is broken client-side** | `state.dart:137` maps only book numbers 20/40/8 back to names, and `state.dart:204-210` maps only `prov`/`matt`/`ruth` to numbers. Reading John and adding a note stores `book_number: 0`; restoring progress in any other book silently falls back. `data/books.dart` already has the full table but is not used by these two functions. | Use one canonical book table client-side (port `data/books.dart:16-83` verbatim — it matches the server's `server/app/scripture/books.py` exactly) and one `bookNumberFromAny` matching the server's alias normalisation. This is a real data-corruption bug; do not reproduce it. |
| 11 | **Dead code that looks alive** | `SearchScreen` (unreachable), `artifacts.dart` + the three demo `AskThread`s (fixture-only), the entire Ruth 2 authored path, `assets/textures/*.png` (never declared in `pubspec.yaml`), `scroll_animator` + `web_smooth_scroll` (unused deps), `verseSize` (persisted but only affects the offline sample on phone). | Do not port any of it. Listed here so the next agent does not mistake fixture richness for shipped features. |

---

## 9 · Recommended Expo file tree

Assumes Expo Router, pnpm workspaces, and phone-first (Q-006). Old → new mapping in the
right column.

```
apps/mobile/
├── app/
│   ├── _layout.tsx                     ← main.dart (providers: Query, Zustand hydrate, fonts, Clerk)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── sign-in.tsx                 ← main.dart:186-229 (_SignInScreen)
│   ├── (tabs)/
│   │   ├── _layout.tsx                 ← app_shell.dart:187-288 (_BottomNav)
│   │   ├── index.tsx          Today    ← screens/today_screen.dart
│   │   ├── read.tsx           Reader   ← screens/reader_screen.dart (redirects to the saved ref)
│   │   ├── ask.tsx            Ask      ← screens/ask_screen.dart + widgets/ask_view.dart
│   │   └── library.tsx        Library  ← screens/library_screen.dart
│   ├── read/[book]/[chapter].tsx       ← reader route proper; params replace state.book/chapter
│   ├── settings/index.tsx              ← screens/sources_screen.dart
│   └── (modals)/
│       ├── reference-picker.tsx        ← widgets/reference_picker.dart
│       ├── search.tsx                  ← widgets/search_overlay.dart  (NOT search_screen.dart)
│       └── translation.tsx             ← reader_screen.dart:699-847 (_TranslationMenu)
│
├── src/
│   ├── features/
│   │   ├── reader/
│   │   │   ├── ReaderHeader.tsx        ← reader_screen.dart:455-597
│   │   │   ├── VerseList.tsx           ← reader_screen.dart:116-184
│   │   │   ├── Verse.tsx               ← reader_screen.dart:277-383  (constant footprint, 3 states)
│   │   │   ├── VerseWordChip.tsx       ← reader_screen.dart:387-419
│   │   │   ├── ChapterContextBanner.tsx← reader_screen.dart:599-646
│   │   │   ├── OfflineBanner.tsx       ← reader_screen.dart:421-453
│   │   │   └── useScrollToFocusedWord.ts ← reader_screen.dart:119-138
│   │   ├── context/
│   │   │   ├── ContextSheet.tsx        ← app_shell.dart:105-185 (@gorhom/bottom-sheet)
│   │   │   ├── PanelSwitch.tsx         ← context_panel.dart:85-169
│   │   │   ├── StudyTabs.tsx           ← context_panel.dart:172-204
│   │   │   ├── StudyOverview.tsx       ← context_panel.dart:317-387
│   │   │   ├── StudyWords.tsx          ← context_panel.dart:389-549
│   │   │   ├── StudyCommentary.tsx     ← context_panel.dart:551-589
│   │   │   ├── StudyEmpty.tsx          ← context_panel.dart:255-315  (3 distinct states)
│   │   │   ├── VersePanel.tsx          ← context_panel.dart:606-917
│   │   │   ├── VerseActions.tsx        ← context_panel.dart:622-648, 780-841
│   │   │   └── CrossRefList.tsx        ← context_panel.dart:919-1014
│   │   ├── chat/
│   │   │   ├── ReaderChatPanel.tsx     ← widgets/reader_chat.dart
│   │   │   ├── AskConversation.tsx     ← ask_view.dart:118-252
│   │   │   ├── MessageBubble.tsx       ← ask_view.dart:254-297 / reader_chat.dart:209-253
│   │   │   ├── StreamingMessage.tsx    ← ask_view.dart:299-321
│   │   │   ├── Composer.tsx            ← ask_view.dart:479-623
│   │   │   ├── ThinkingSkeleton.tsx    ← ask_view.dart:353-383
│   │   │   ├── ToolUseChips.tsx        ← chat_markdown.dart:149-205
│   │   │   ├── ChatMarkdown.tsx        ← chat_markdown.dart:15-79
│   │   │   ├── scriptureRefPlugin.ts   ← chat_markdown.dart:83-117
│   │   │   ├── ThreadList.tsx          ← app_shell.dart:761-890
│   │   │   └── useAutoPin.ts           ← ask_view.dart:155-164 / reader_chat.dart:42-52
│   │   ├── search/{SearchField,ScopePills,HitRow,highlightQuery}.tsx
│   │   │                               ← search_overlay.dart
│   │   └── library/{NoteCard,HighlightCard}.tsx  ← library_screen.dart
│   │
│   ├── components/                     ← widgets/atoms.dart, glass.dart
│   │   ├── Pill.tsx  AccentChip.tsx  PillToggle.tsx  Card.tsx
│   │   ├── SectionLabel.tsx            ← MonoCaption
│   │   ├── RiseIn.tsx                  ← atoms.dart:7-60 (Reanimated FadeInDown, delay i*55)
│   │   ├── PressScale.tsx              ← glass.dart:118-155
│   │   ├── Shimmer.tsx  Spinner.tsx    ← ask_view.dart:14-113
│   │   └── Surface.tsx                 ← glass.dart:38-115 (blur only for transient overlays)
│   │
│   ├── api/                            ← services/
│   │   ├── client.ts                   ← content_api.dart:17-38 (+ auth interceptor)
│   │   ├── bible.ts                    ← bible_api.dart          (#1, #2)
│   │   ├── chat.stream.ts              ← chat_service.dart       (#3, SSE)
│   │   ├── content.ts                  ← content_api.dart        (#4–#23)
│   │   └── queries/{useChapter,useStudy,useCrossRefs,useNotes,useHighlights,
│   │                useSearch,useAskThreads,useReaderChat,useProgress,usePrefs}.ts
│   │
│   ├── stores/
│   │   ├── reader.store.ts  ui.store.ts  prefs.store.ts  chat.store.ts   ← §4
│   │
│   ├── domain/                         ← models/, data/books.dart
│   │   ├── books.ts                    ← data/books.dart:16-83 (all 66, + aliases)
│   │   ├── verseKey.ts                 ← server/app/scripture/refs.py:7-19
│   │   └── types.ts                    ← generated from FastAPI OpenAPI
│   │
│   └── theme/                          ← theme.dart
│       ├── colors.ts  typography.ts  radius.ts  motion.ts  spacing.ts  index.ts
│
├── assets/fonts/                       (serif + sans, vendored — replaces google_fonts)
└── app.json  tsconfig.json  package.json

packages/
├── api-types/                          (shared with the FastAPI backend)
└── design-tokens/                      (if the token set is shared with a web surface)
```

**Not ported:** `screens/search_screen.dart` (unreachable), `widgets/artifacts.dart`,
`widgets/wiki_text.dart#VerseText`, `widgets/resizable_split.dart` (unless Q-006 says
otherwise), `widgets/smooth_scroll.dart`, `widgets/patterns.dart`,
`services/clerk_persistor.dart`, `data/content.dart`, `data/models.dart`, the six authored
context tabs and `_EntityView` in `context_panel.dart`.

---

## Open questions

Things the code does not settle. Listed rather than guessed.

1. **Does the new product keep the two-chat split?** Global Ask threads
   (`ask_threads`) and per-chapter reader chat (`reading_chats`) are separate tables, UIs and
   persistence models sharing one endpoint. Queued as **Q-005**; recommendation is one
   unified chat that carries passage context.
2. **Tablet/desktop layouts.** ~⅓ of the Flutter UI code exists for `≥600 dp` and
   `≥1100 dp`. Queued as **Q-006**; recommendation is phone-only.
3. **Does the "artifact" concept survive?** In Flutter it only ever renders for three
   hardcoded demo threads; nothing in the API produces one. The PRD's badge sheets appear to
   replace it, but that is inference, not evidence.
4. **`entityStack` / the wiki graph.** A complete deep-linkable concept-page system exists
   (`state.dart:467-484`, `context_panel.dart:1807-1926`) but is fed entirely by a
   hardcoded 6-entry map in `data/content.dart:55`. Unclear whether this was a dropped
   direction or a not-yet-built one. There is no backend endpoint for entities.
5. **`ContextTab.original / culture / map` and `HebMode`.** Reachable only on the offline
   Ruth 2 path, yet the Original tab is *also* linked from a live-path button
   (`reader_screen.dart:561`, `:800`) which maps to `ContextTab.word` on the live tab strip.
   The intended live behaviour of "Original" is ambiguous.
6. **`verseSize`.** Persisted to `/me/prefs` and read at bootstrap, but only ever applied to
   the offline sample on phone (`reader_screen.dart:188`). Live scripture size is
   breakpoint-derived. Was a text-size setting planned and dropped, or is this a bug?
7. **Translations.** `GET /translations` returns whatever is loaded, and
   `translationLabel` only knows `KJVPCE → KJV` (`state.dart:63-64`). Whether more
   translations are coming (and whether they are licensable) is not answerable from the code.
8. **`GET /study/available` vs `enrichedBooks`.** The endpoint exists and is unused; the
   client hardcodes `{20, 40}` and `chapter <= 10`. Presumably an oversight, but confirm
   before relying on the endpoint's output shape.
9. **`prefs` GET/PUT asymmetry.** `GET /me/prefs` returns the bare object;
   `PUT /me/prefs` expects `{ "prefs": {...} }` (`content_api.dart:146-150`,
   `server/app/routers/user.py:161-178`). Intentional or accidental — worth fixing in the
   rewrite either way.
