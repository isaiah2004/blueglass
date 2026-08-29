/**
 * The seam behind "Save as Flashcard".
 *
 * Purpose
 *   `image6.png` puts a gold primary action at the foot of the `[Root]` sheet, and it is
 *   the one control on that sheet that changes something. Flashcard *storage* is a later
 *   milestone — decision `A-03` puts flashcards among the things that sync across devices,
 *   and syncing means a server table, a conflict rule and an SM-2 scheduler, none of which
 *   belong in a sheet. What belongs here is the seam: a typed record, a place to put it,
 *   and a truthful statement to the reader about how far it has got.
 *
 * What this IS
 *   A session-lifetime store of saved drafts, keyed by Strong's number. It makes the button
 *   honest — pressing it changes state, the state is observable, and pressing it again
 *   un-saves — without pretending to a durability it does not have.
 *
 * What this is NOT, and must not become
 *   - Not persisted. Nothing here survives a reload, and `SAVE_CONFIRMATION` says so to the
 *     reader rather than leaving them to discover it.
 *   - Not a scheduler. No interval, no ease factor, no due date. SM-2 belongs with the
 *     Studio milestone that owns review sessions.
 *   - Not the final home. When flashcards ship, this store moves to `src/stores` beside the
 *     other three and gains a repository behind it. Everything above it depends only on
 *     `useFlashcardDrafts`, so that move is an import change.
 *
 * Why a store rather than a callback prop
 *   The `[Root]` sheet renders in two homes — a bottom sheet on a phone, the context rail
 *   on a tablet (`Q-006`) — and a saved state that lived in the sheet's own props would
 *   reset when the reader switched breakpoint or reopened the badge. Saved is a fact about
 *   the word, not about the sheet.
 *
 * Dependencies
 *   `zustand`, and the folder's payload types. No persistence middleware: `react-native-mmkv`
 *   has no web build and web is a first-class target (`T-01`), so anything persisted here
 *   would have to go through `@/api/storage`, which is the later milestone's decision to make.
 */

import { create } from 'zustand';

import type { OriginalLanguage, RootSheetPayload } from '../model/textual-payloads';

/** What the reader is told when a card is saved. It must not overstate what happened. */
export const SAVE_CONFIRMATION =
  'Saved for this session. Review scheduling and sync across your devices arrive with Studio.';

/** One saved word, in the shape a future scheduler would wrap rather than replace. */
export interface FlashcardDraft {
  /** Strong's number including its language prefix. The identity of the card. */
  readonly strongsNumber: string;
  /** The headword in its own script. */
  readonly lemma: string;
  /** Its language, which a review screen needs to lay the front of the card out. */
  readonly language: OriginalLanguage;
  /** Latin-script rendering, when the lexicon has one. */
  readonly transliteration?: string | undefined;
  /** The short gloss — the back of the card. */
  readonly gloss: string;
  /** The packed key of the verse the reader saved it from, so the card can cite itself. */
  readonly sourceVerseKey: number;
  /** When it was saved, as epoch milliseconds. Ordering only. */
  readonly savedAt: number;
}

/** The drafts held for this session, and the actions over them. */
export interface FlashcardDraftSlice {
  /** Every saved draft, keyed by Strong's number. */
  readonly drafts: Readonly<Record<string, FlashcardDraft>>;
  /** Save a draft, replacing any earlier save of the same word. */
  save(draft: FlashcardDraft): void;
  /** Remove a draft. Idempotent. */
  remove(strongsNumber: string): void;
  /** Save if absent, remove if present. What the sheet's button calls. */
  toggle(draft: FlashcardDraft): void;
  /** Drop every draft. For tests and for a future "clear saved words". */
  clear(): void;
}

/** The session store. */
export const useFlashcardDrafts = create<FlashcardDraftSlice>()((set, get) => ({
  drafts: {},

  save(draft: FlashcardDraft): void {
    set((state) => ({ drafts: { ...state.drafts, [draft.strongsNumber]: draft } }));
  },

  remove(strongsNumber: string): void {
    set((state) => {
      const { [strongsNumber]: removed, ...rest } = state.drafts;
      // `removed` is read only to name what the rest spread excludes; without the binding
      // there is no way to write this destructuring at all.
      void removed;

      return { drafts: rest };
    });
  },

  toggle(draft: FlashcardDraft): void {
    const saved = get().drafts[draft.strongsNumber] !== undefined;
    if (saved) {
      get().remove(draft.strongsNumber);

      return;
    }
    get().save(draft);
  },

  clear(): void {
    set({ drafts: {} });
  },
}));

/**
 * Whether a word is saved.
 *
 * A selector factory rather than a selector, because the answer depends on which word the
 * sheet is showing. Subscribing to one boolean instead of to the whole map is what stops a
 * save on one word re-rendering a sheet showing another.
 *
 * @param strongsNumber - The word's Strong's number.
 * @returns A selector over the store's state. Side effects: none.
 *
 * @example
 * const saved = useFlashcardDrafts(selectIsSaved('G4211'));
 */
export function selectIsSaved(strongsNumber: string): (state: FlashcardDraftSlice) => boolean {
  return (state) => state.drafts[strongsNumber] !== undefined;
}

/** How many words are saved this session. */
export const selectSavedCount = (state: FlashcardDraftSlice): number =>
  Object.keys(state.drafts).length;

/**
 * Build a draft from what the sheet is showing.
 *
 * @param payload - The `[Root]` payload on screen.
 * @param sourceVerseKey - The packed key of the verse the badge is anchored to.
 * @param savedAt - Epoch milliseconds. Injected rather than read from the clock so the
 *   record stays a pure function of its inputs and can be asserted on.
 * @returns The draft. Side effects: none.
 */
export function draftFromPayload(
  payload: RootSheetPayload,
  sourceVerseKey: number,
  savedAt: number,
): FlashcardDraft {
  return {
    strongsNumber: payload.strongsNumber,
    lemma: payload.lemma,
    language: payload.language,
    transliteration: payload.transliteration,
    gloss: payload.gloss,
    sourceVerseKey,
    savedAt,
  };
}
