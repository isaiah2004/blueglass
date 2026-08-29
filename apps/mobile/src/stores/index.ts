/**
 * Client-owned state: four stores, split by lifetime and owner.
 *
 * Purpose
 *   The public surface of `src/stores`, and the place the four-store split from
 *   `docs/architecture/flutter-port-map.md` §4 is written down.
 *
 * The four, and why there are four rather than one
 *   | store        | holds                                   | lifetime          |
 *   |--------------|-----------------------------------------|-------------------|
 *   | `prefs`      | translation, size, RAG and web toggles  | **persisted**     |
 *   | `reader`     | address, selected verse, panel, tab     | the session       |
 *   | `ui`         | which overlay is open, the search box   | the session       |
 *   | `chat draft` | the in-flight assistant reply           | one streaming turn|
 *
 *   The prototype had one — `LampState`, 821 lines, everything from the UI mode to two
 *   chat conversations — and `AppShell` subscribed to all of it, so every change
 *   re-rendered the whole app. Flutter absorbs that; React does not. The split is not
 *   tidiness, it is the fix.
 *
 * The fourth store is re-exported, not defined here
 *   `chatDraftStore` lives in `src/api/stream` because it is written by the SSE client
 *   and commits once per animation frame. It is surfaced here so the four-store split is
 *   visible in one place — but the rule attached to it is absolute:
 *   **no layout or shell component may subscribe to it.** Port map risk #2.
 *
 * What is NOT here
 *   Anything the server owns. A chapter's text, the translation list, search results and
 *   study content are all TanStack Query's (`src/api/query`). A copy of server data in a
 *   Zustand store is a cache that nothing invalidates.
 *
 * Usage
 *   ```ts
 *   const size = usePrefs(selectScriptureSize);
 *   const overlay = useUi(selectOverlay);
 *   ```
 */

// --- Persisted -----------------------------------------------------------------------
export {
  DEFAULT_PREFS,
  DEFAULT_TRANSLATION_CODE,
  selectScriptureSize,
  selectTranslationCode,
  selectUseRag,
  selectWebSearch,
  usePrefs,
  type PrefsSlice,
  type PrefsState,
  type ScriptureSize,
} from './prefs.store';

// --- Session -------------------------------------------------------------------------
export {
  DEFAULT_READER_ADDRESS,
  selectAddress,
  selectFocusedWord,
  selectPanel,
  selectSelectedVerseKey,
  selectStudyTab,
  useReader,
  type ReaderAddress,
  type ReaderPanel,
  type ReaderSlice,
  type ReaderState,
  type StudyTab,
} from './reader.store';

export {
  selectHasOverlay,
  selectOverlay,
  selectSearchQuery,
  selectSearchScopeBook,
  useUi,
  type ReaderOverlay,
  type UiSlice,
  type UiState,
} from './ui.store';

// --- Streaming (defined in `src/api/stream`; see the header) --------------------------
export {
  chatDraftStore,
  selectDraftError,
  selectDraftMeta,
  selectDraftStatus,
  selectDraftText,
  type ChatDraftSlice,
  type ChatDraftState,
  type ChatDraftStatus,
} from '@/api/stream';

// --- Persistence plumbing -------------------------------------------------------------
export { toStateStorage } from './state-storage';
