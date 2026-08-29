/**
 * The reader's preferences — the one store that outlives the process.
 *
 * Purpose
 *   Port map §4's `prefs.store`. Four choices that must survive a relaunch: which
 *   translation is open, how large the scripture is set, and whether grounded retrieval
 *   and web search are on for AI answers. The prototype kept all four in its single
 *   821-line `LampState` and mirrored them to `PUT /me/prefs`
 *   (`state.dart`, port map §5 endpoints 15 and 16).
 *
 * Why this store persists and the other two do not
 *   These are decisions the reader made about how they read. Losing them is a small,
 *   permanent annoyance. `reader.store` and `ui.store` hold where the reader is *right
 *   now* — a selected verse, an open sheet — and restoring those on a cold start would
 *   be worse than forgetting them: the app would reopen mid-gesture.
 *
 * Server sync is deliberately not here
 *   Decision `A-03` says preferences sync across devices, and the endpoint exists. But
 *   sync needs conflict resolution, and a store that writes to the network on every
 *   keystroke of a slider is the wrong place to decide who wins. This store owns the
 *   local truth; a sync effect subscribing to it is a separate, testable thing.
 *
 * Subscribe with a selector
 *   `usePrefs((s) => s.scriptureSize)`, never `usePrefs()`. Port map risk #2 is about
 *   the streaming draft store, but the rule is general: a component that subscribes to
 *   a whole store re-renders on every field it does not use.
 *
 * Dependencies
 *   `zustand`, its `persist` middleware, and the storage adapter. No React Native, no
 *   direct storage engine.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { deviceKeyValueStore, PREFERENCES_STORAGE_KEY, type KeyValueStore } from '@/api/storage';

import { toStateStorage } from './state-storage';

/** How large the scripture serif is set. Named steps, not a font size in points. */
export type ScriptureSize = 'small' | 'medium' | 'large';

/**
 * The translation the app opens in before anyone chooses.
 *
 * Matches the API's own `DEFAULT_TRANSLATION` (`Q-024`): the Berean Standard Bible,
 * public domain since 2023. **ESV appears in the mockups, is licensed by Crossway, and
 * must never appear here.**
 */
export const DEFAULT_TRANSLATION_CODE = 'BSB';

/** The persisted preferences. */
export interface PrefsState {
  readonly translationCode: string;
  readonly scriptureSize: ScriptureSize;
  /** Retrieve from the reader's own library before answering (`use_rag`). */
  readonly useRag: boolean;
  /** Let the provider's web-search plugin run (`web_search`). */
  readonly webSearch: boolean;
}

/** Preferences plus the actions that change them. */
export interface PrefsSlice extends PrefsState {
  setTranslationCode(code: string): void;
  setScriptureSize(size: ScriptureSize): void;
  setUseRag(enabled: boolean): void;
  setWebSearch(enabled: boolean): void;
  /** Restore every default. For "reset reading settings". */
  reset(): void;
}

/** The shipping defaults. */
export const DEFAULT_PREFS: PrefsState = {
  translationCode: DEFAULT_TRANSLATION_CODE,
  scriptureSize: 'medium',
  useRag: true,
  webSearch: false,
};

/**
 * Build a preferences store over a given engine.
 *
 * Exported so a test can build one over a store it controls and prove that a value
 * written in one "launch" is read back in the next. The app uses {@link usePrefs},
 * which is this factory over the platform's engine — one code path, not two.
 *
 * @param store - Where to persist. Defaults to the platform's.
 * @returns A bound Zustand hook with a `persist` API attached.
 */
export function createPrefsStore(store: KeyValueStore = deviceKeyValueStore) {
  return create<PrefsSlice>()(
    persist(
      (set) => ({
        ...DEFAULT_PREFS,

        setTranslationCode(translationCode: string): void {
          set({ translationCode });
        },

        setScriptureSize(scriptureSize: ScriptureSize): void {
          set({ scriptureSize });
        },

        setUseRag(useRag: boolean): void {
          set({ useRag });
        },

        setWebSearch(webSearch: boolean): void {
          set({ webSearch });
        },

        reset(): void {
          set({ ...DEFAULT_PREFS });
        },
      }),
      {
        name: PREFERENCES_STORAGE_KEY,
        storage: createJSONStorage(() => toStateStorage(store)),
        // Actions are recreated by the factory on every launch; storing them would write
        // `{}` for each and then overwrite the live functions with it on rehydration.
        partialize: (state): PrefsState => ({
          translationCode: state.translationCode,
          scriptureSize: state.scriptureSize,
          useRag: state.useRag,
          webSearch: state.webSearch,
        }),
      },
    ),
  );
}

/**
 * The preferences store.
 *
 * Hydration is asynchronous, because the storage contract is. The first render
 * therefore sees {@link DEFAULT_PREFS} and re-renders once when the stored values
 * arrive — a single frame of the default translation, which is preferable to gating the
 * whole app on a storage read.
 */
export const usePrefs = createPrefsStore();

/** Stable selectors. An inline lambda in a component resubscribes on every render. */
export const selectTranslationCode = (state: PrefsState): string => state.translationCode;
export const selectScriptureSize = (state: PrefsState): ScriptureSize => state.scriptureSize;
export const selectUseRag = (state: PrefsState): boolean => state.useRag;
export const selectWebSearch = (state: PrefsState): boolean => state.webSearch;
