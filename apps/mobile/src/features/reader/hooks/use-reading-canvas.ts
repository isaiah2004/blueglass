/**
 * Everything the reading canvas needs, gathered once.
 *
 * Purpose
 *   `ReaderScreen` is a composition, and a composition reads badly when half of it is
 *   hook calls and derived values. This hook is that half: it takes an address and returns
 *   the queries, the selection, the resolved type size, and the layout numbers. The screen
 *   below it becomes a description of what is on the page.
 *
 * Why the route writes into the store
 *   The route is the source of truth for where the reader is. The shared reader store is
 *   how everything *else* — a context panel, a streak, a future "continue reading" — learns
 *   about it without reaching into the navigator. One writer, many readers.
 *
 * Dependencies
 *   `@/api`, `@/stores`, `@/theme/runtime`, and the reader's own hooks and models.
 */

import { useEffect } from 'react';

import {
  useChapterQuery,
  useTranslationsQuery,
  type ApiChapter,
  type AtlasQueryResult,
} from '@/api';
import { contextRailMode, type ContextRailMode } from '@/components/split/context-rail-mode';
import { selectScriptureSize, selectTranslationCode, usePrefs, useReader } from '@/stores';
import { useIsReduceMotionEnabled, useResponsiveLayout } from '@/theme/runtime';
import type { ScriptureStep } from '@/theme';

import type { ReaderAddress } from '../model/reader-address';
import { columnMaxWidth, readerGutterFor } from '../model/reader-canvas';
import { resolveReadingStep } from '../model/reading-size';

import { useVerseBadges, type VerseBadgeMap } from './use-verse-badges';
import { useVerseSelection, type VerseSelectionController } from './use-verse-selection';

/** The view model the reader screen renders. */
export interface ReadingCanvas {
  readonly chapterQuery: AtlasQueryResult<ApiChapter>;
  readonly translationCode: string;
  /** The active translation's full name, once the switcher's list has landed. */
  readonly translationName: string | undefined;
  readonly translationsLoading: boolean;
  readonly selection: VerseSelectionController;
  readonly badges: VerseBadgeMap;
  readonly scriptureStep: ScriptureStep;
  readonly gutter: number;
  readonly columnMaxWidth: number | undefined;
  readonly reduceMotion: boolean;
  /**
   * Whether the context rail exists at this width, and whether it can be dragged.
   *
   * The reader does not decide this — `@/components/split/context-rail-mode` does, and
   * `ContextRailShell` lays it out from the same answer. Asking the shared rule is what
   * stops the reader believing it has a rail on a width that has none.
   */
  readonly railMode: ContextRailMode;
  /** True when a selected verse opens beside the scripture rather than in a sheet. */
  readonly contextIsPinned: boolean;
}

/**
 * Assemble the canvas for one address.
 *
 * @param address - The validated address the route resolved.
 * @returns Everything `ReaderScreen` renders. Side effects: fetches the chapter and the
 *   translation list, and mirrors the address into the shared reader store.
 */
export function useReadingCanvas(address: ReaderAddress): ReadingCanvas {
  const responsive = useResponsiveLayout();
  const reduceMotion = useIsReduceMotionEnabled();
  const translationCode = usePrefs(selectTranslationCode);
  const scriptureSize = usePrefs(selectScriptureSize);
  // Zustand actions are closures created in the store factory, never `this`-bound, so
  // selecting one is safe. The rule cannot see that from the interface's method syntax.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setStoreAddress = useReader((state) => state.setAddress);

  const chapterQuery = useChapterQuery({
    translation: translationCode,
    book: address.book.osis,
    chapter: address.chapter,
  });
  const translationsQuery = useTranslationsQuery();
  const selection = useVerseSelection({
    bookNumber: address.book.canonicalNumber,
    chapter: address.chapter,
  });
  const badges = useVerseBadges(chapterQuery.data);
  const railMode = contextRailMode({
    width: responsive.width,
    formFactor: responsive.formFactor,
  });

  useEffect(() => {
    setStoreAddress({
      translation: translationCode,
      book: address.book.osis,
      chapter: address.chapter,
    });
  }, [setStoreAddress, translationCode, address.book.osis, address.chapter]);

  return {
    chapterQuery,
    translationCode,
    translationName: translationsQuery.data?.find((item) => item.code === translationCode)?.name,
    translationsLoading: translationsQuery.isPending,
    selection,
    badges,
    scriptureStep: resolveReadingStep(scriptureSize, responsive.scriptureStep),
    gutter: readerGutterFor(responsive.formFactor),
    columnMaxWidth: columnMaxWidth(responsive.readingMeasure),
    reduceMotion,
    railMode,
    contextIsPinned: railMode !== 'none',
  };
}
