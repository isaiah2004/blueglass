/**
 * Verse selection and highlighting, bound to a chapter.
 *
 * Purpose
 *   `model/verse-selection` owns the rules. This hook owns their lifetime, and it is where
 *   the reader's two vocabularies meet: `@/stores`'s reader store tracks the open verse as
 *   a packed `verseKey`, because that is what a badge sheet or a cross-reference will
 *   point at; the canvas tracks it as a verse *number*, because that is what a row knows
 *   about itself.
 *
 * Why selection lives in the shared store and highlights do not
 *   The open verse is read by more than the canvas — the context panel's grounding string
 *   narrows to it (`flutter-port-map.md` §7.3, "selection also drives the chat"), so one
 *   store must own it. Highlights are the reader's own persistent marks, and the shared
 *   store has no field for them yet; they stay here until they are server-persisted user
 *   data, which is where they belong. Queued as `R-03` in `docs/decisions/ASSUMPTIONS.md`.
 *
 * Optimistic highlighting
 *   The set changes before anything is persisted — `flutter-port-map.md` §7.3's rule. A
 *   highlight that lags a long-press does not feel like a highlight, and losing one to a
 *   dead backend costs less than that.
 *
 * Dependencies
 *   React, `@atlas/shared` for the verse-key arithmetic, `@/stores`, and the reader's pure
 *   selection model.
 */

import { makeVerseKey, verseKeyFromNumber } from '@atlas/shared';
import { useCallback, useMemo, useState } from 'react';

import { useReader } from '@/stores';

import { toggleHighlightedVerse, type VerseSelection } from '../model/verse-selection';

/** Which chapter the selection belongs to. */
export interface SelectionChapter {
  readonly bookNumber: number;
  readonly chapter: number;
}

/** What the reader screen needs to drive selection. */
export interface VerseSelectionController {
  readonly selection: VerseSelection;
  /**
   * Open or close a verse.
   *
   * @param verseNumber - The verse that was tapped.
   */
  readonly selectVerse: (verseNumber: number) => void;
  /**
   * Add or remove a highlight.
   *
   * @param verseNumber - The verse that was held.
   */
  readonly highlightVerse: (verseNumber: number) => void;
  /**
   * Close whatever verse is open.
   *
   * Distinct from `selectVerse` on purpose: that one toggles, and a "close" button wired
   * to a toggle re-opens the verse the moment anything re-renders with the same number.
   */
  readonly clearSelection: () => void;
}

/** Highlights, keyed by the chapter they belong to. */
type HighlightsByChapter = ReadonlyMap<string, ReadonlySet<number>>;

/**
 * A stable key for one chapter of one translation.
 *
 * @param chapter - The chapter being read.
 * @returns A map key. Side effects: none.
 */
function chapterKeyOf(chapter: SelectionChapter): string {
  return `${String(chapter.bookNumber)}:${String(chapter.chapter)}`;
}

/**
 * The verse number a packed key refers to, when it belongs to this chapter.
 *
 * @param verseKey - The store's packed key, or `null`.
 * @param chapter - The chapter on screen.
 * @returns The verse number, or `null` when nothing in this chapter is open. A key from
 *   another chapter reads as "nothing selected" rather than lighting up the wrong row.
 *   Side effects: none.
 */
function verseNumberIn(verseKey: number | null, chapter: SelectionChapter): number | null {
  if (verseKey === null) {
    return null;
  }
  const decoded = verseKeyFromNumber(verseKey);
  if (!decoded.ok) {
    return null;
  }
  const inThisChapter =
    decoded.value.book.canonicalNumber === chapter.bookNumber &&
    decoded.value.chapter === chapter.chapter;
  return inThisChapter ? decoded.value.verse : null;
}

/**
 * Selection state for one chapter.
 *
 * @param chapter - Which chapter is on screen. Changing it clears nothing by itself: the
 *   open verse simply stops matching, and the highlight set is looked up under a new key.
 * @returns The selection and its two commands. Side effects: writes the open verse to the
 *   shared reader store.
 */
export function useVerseSelection(chapter: SelectionChapter): VerseSelectionController {
  const selectedVerseKey = useReader((state) => state.selectedVerseKey);
  // Zustand actions are closures created in the store factory, never `this`-bound, so
  // selecting one is safe. The rule cannot see that from the interface's method syntax.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const selectVerseKey = useReader((state) => state.selectVerse);
  const [highlights, setHighlights] = useState<HighlightsByChapter>(() => new Map());

  const chapterKey = chapterKeyOf(chapter);
  const selectedVerse = verseNumberIn(selectedVerseKey, chapter);

  const selection = useMemo<VerseSelection>(
    () => ({
      selected: selectedVerse,
      highlighted: highlights.get(chapterKey) ?? new Set<number>(),
    }),
    [selectedVerse, highlights, chapterKey],
  );

  const selectVerse = useCallback(
    (verseNumber: number) => {
      const key = makeVerseKey(chapter.bookNumber, chapter.chapter, verseNumber);
      if (!key.ok) {
        // Unreachable with API data: the chapter and verse both came from the server.
        // Ignoring the tap is still the right failure — a reader loses one tap, not the page.
        return;
      }
      selectVerseKey(key.value.value === selectedVerseKey ? null : key.value.value);
    },
    [chapter.bookNumber, chapter.chapter, selectVerseKey, selectedVerseKey],
  );

  const highlightVerse = useCallback(
    (verseNumber: number) => {
      setHighlights((current) => {
        const next = new Map(current);
        const forChapter: VerseSelection = {
          selected: null,
          highlighted: current.get(chapterKey) ?? new Set<number>(),
        };
        next.set(chapterKey, toggleHighlightedVerse(forChapter, verseNumber).highlighted);
        return next;
      });
    },
    [chapterKey],
  );

  const clearSelection = useCallback(() => {
    selectVerseKey(null);
  }, [selectVerseKey]);

  return { selection, selectVerse, highlightVerse, clearSelection };
}
