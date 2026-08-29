/**
 * Where the reader is, and what they have opened around the text.
 *
 * Purpose
 *   Port map §4's `reader.store`: the client-owned half of the reading canvas. The
 *   chapter's *text* is not here — that is server-owned and lives in TanStack Query
 *   (`src/api/query`). What is here is everything the reader did to it: which verse they
 *   tapped, which word they focused, which panel and tab are showing.
 *
 * The line this store draws
 *   The prototype's `LampState` held both, and `AppShell.build` subscribed to the whole
 *   thing (`app_shell.dart:27`), so every chapter load re-rendered the entire app. The
 *   split is what prevents that: a verse selection touches this store and nothing else,
 *   and a chapter arriving touches the query cache and nothing else.
 *
 * Address versus route
 *   `translation`, `book` and `chapter` are mirrored here from the Expo Router
 *   parameters, not owned here. The URL is the source of truth — that is what makes a
 *   chapter deep-linkable and the back button correct. `setAddress` exists so a
 *   navigation can push the new address in one call, and so that everything derived
 *   from it (the selection, the focused word) is cleared in the same update rather than
 *   in three effects that each cause a render.
 *
 * Subscribe with a selector
 *   `useReader((s) => s.selectedVerseKey)`. Never subscribe to the whole store from a
 *   layout component.
 *
 * Dependencies
 *   `zustand` only. No React Native, no I/O, no persistence: this is where the reader is
 *   *now*, and restoring it on a cold start would reopen the app mid-gesture.
 */

import { create } from 'zustand';

import { DEFAULT_TRANSLATION_CODE } from './prefs.store';

/** Which pane the context rail is showing. */
export type ReaderPanel = 'study' | 'chat';

/** Which tab of the study pane is showing. */
export type StudyTab = 'overview' | 'words' | 'commentary';

/** Which chapter is open. Mirrored from the route. */
export interface ReaderAddress {
  readonly translation: string;
  /** Name, OSIS code, alias, or number — whatever the route carried. */
  readonly book: string;
  readonly chapter: number;
}

/** The reader's client-owned state. */
export interface ReaderState {
  readonly address: ReaderAddress;
  /**
   * The packed `verse_key` of the open verse, or `null`.
   *
   * A number rather than a validated `VerseKey`: this is a selection, and re-validating
   * it against the canon on every tap would buy nothing the API has not already proven.
   */
  readonly selectedVerseKey: number | null;
  /** The original-language term the word-study chip is expanded on. */
  readonly focusedWord: string | null;
  readonly panel: ReaderPanel;
  readonly studyTab: StudyTab;
}

/** State plus the actions that drive it. */
export interface ReaderSlice extends ReaderState {
  /** Open a chapter. Clears the selection and the focused word in the same update. */
  setAddress(address: ReaderAddress): void;
  /** Select a verse, or pass `null` to close the verse panel. */
  selectVerse(verseKey: number | null): void;
  /** Focus a word, or the same word again to unfocus it — the prototype's toggle. */
  focusWord(term: string | null): void;
  setPanel(panel: ReaderPanel): void;
  setStudyTab(tab: StudyTab): void;
}

/** Where a reader with no history lands: the first chapter of the first book. */
export const DEFAULT_READER_ADDRESS: ReaderAddress = {
  translation: DEFAULT_TRANSLATION_CODE,
  book: 'Genesis',
  chapter: 1,
};

/** The empty canvas: a chapter open, nothing selected. */
const INITIAL_READER_STATE: ReaderState = {
  address: DEFAULT_READER_ADDRESS,
  selectedVerseKey: null,
  focusedWord: null,
  panel: 'study',
  studyTab: 'overview',
};

/** The reader store. */
export const useReader = create<ReaderSlice>()((set, get) => ({
  ...INITIAL_READER_STATE,

  setAddress(address: ReaderAddress): void {
    set({ address, selectedVerseKey: null, focusedWord: null });
  },

  selectVerse(selectedVerseKey: number | null): void {
    set({ selectedVerseKey });
  },

  focusWord(term: string | null): void {
    set({ focusedWord: get().focusedWord === term ? null : term });
  },

  setPanel(panel: ReaderPanel): void {
    set({ panel });
  },

  setStudyTab(studyTab: StudyTab): void {
    set({ studyTab });
  },
}));

/** Stable selectors. */
export const selectAddress = (state: ReaderState): ReaderAddress => state.address;
export const selectSelectedVerseKey = (state: ReaderState): number | null =>
  state.selectedVerseKey;
export const selectFocusedWord = (state: ReaderState): string | null => state.focusedWord;
export const selectPanel = (state: ReaderState): ReaderPanel => state.panel;
export const selectStudyTab = (state: ReaderState): StudyTab => state.studyTab;
