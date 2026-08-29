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
import {
  contentWidthFor,
  contextRailMode,
  contextRailWidth,
  type ContextRailMode,
} from '@/components/split/context-rail-mode';
import { selectScriptureSize, selectTranslationCode, usePrefs, useReader } from '@/stores';
import { useIsReduceMotionEnabled, useResponsiveLayout } from '@/theme/runtime';
import type { ScriptureStep } from '@/theme';

import type { ReaderAddress } from '../model/reader-address';
import {
  columnMaxWidth,
  readerGutterFor,
  readerPaneWidth,
  readerScriptureStep,
} from '../model/reader-canvas';
import { resolveReadingStep } from '../model/reading-size';

import { useBadgeSelection, type BadgeSelection, type SourceAttribution } from '../badges';
import { useVerseBadges, type ChapterBadgeView } from './use-verse-badges';
import { useVerseSelection, type VerseSelectionController } from './use-verse-selection';

/** The view model the reader screen renders. */
export interface ReadingCanvas {
  readonly chapterQuery: AtlasQueryResult<ApiChapter>;
  readonly translationCode: string;
  /** The active translation's full name, once the switcher's list has landed. */
  readonly translationName: string | undefined;
  readonly translationsLoading: boolean;
  readonly selection: VerseSelectionController;
  /**
   * The chapter's badges: the anchors the verses splice in, the ordered list the chapter-end
   * summary draws, and the id lookup a tapped pill resolves through.
   */
  readonly badgeView: ChapterBadgeView;
  /** The union of the chapter's badge sources, for the summary's attribution strip. */
  readonly badgeSources: readonly SourceAttribution[];
  /** Which badge is open, and the two commands that change that. */
  readonly badgeSelection: BadgeSelection;
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

  const location = {
    translation: translationCode,
    book: address.book.osis,
    chapter: address.chapter,
  };
  const chapterQuery = useChapterQuery(location);
  const translationsQuery = useTranslationsQuery();
  const selection = useVerseSelection({
    bookNumber: address.book.canonicalNumber,
    chapter: address.chapter,
  });
  const badgeView = useVerseBadges(location);
  const badgeSelection = useBadgeSelection(
    `${translationCode}/${address.book.osis}/${String(address.chapter)}`,
    badgeView.byId,
  );
  const metrics = canvasMetrics(responsive, scriptureSize);

  useAddressMirror(location);

  return {
    chapterQuery,
    translationCode,
    translationName: translationsQuery.data?.find((item) => item.code === translationCode)?.name,
    translationsLoading: translationsQuery.isPending,
    selection,
    badgeView,
    badgeSources: badgeView.sources,
    badgeSelection,
    reduceMotion,
    ...metrics,
  };
}

/** Where the reader is, in the three fields every query and the store agree on. */
interface ReaderLocation {
  readonly translation: string;
  readonly book: string;
  readonly chapter: number;
}

/**
 * Mirror the route's address into the shared reader store.
 *
 * The route is the source of truth for where the reader is; the store is how everything
 * else — a context panel, a streak, a future "continue reading" — learns about it without
 * reaching into the navigator. One writer, many readers.
 *
 * @param location - Where the reader is now. Side effects: writes to the reader store.
 */
function useAddressMirror(location: ReaderLocation): void {
  // Zustand actions are closures created in the store factory, never `this`-bound, so
  // selecting one is safe. The rule cannot see that from the interface's method syntax.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setStoreAddress = useReader((state) => state.setAddress);
  const { translation, book, chapter } = location;

  useEffect(() => {
    setStoreAddress({ translation, book, chapter });
  }, [setStoreAddress, translation, book, chapter]);
}

/** The layout half of the canvas: how wide the column is and how big the type is. */
type CanvasMetrics = Pick<
  ReadingCanvas,
  'scriptureStep' | 'gutter' | 'columnMaxWidth' | 'railMode' | 'contextIsPinned'
>;

/**
 * Resolve the type size and the column geometry for one window.
 *
 * How much room the scripture actually has is not the window: the nav rail and the context
 * rail both sit inside it. A dragged desktop rail is approximated by its opening width,
 * which is safe because that regime guarantees the pane at least `minReader` — it can never
 * fall into the phone-like band this feeds.
 *
 * @param responsive - The measured window, from `useResponsiveLayout`.
 * @param scriptureSize - The reader's own type-size preference.
 * @returns See {@link CanvasMetrics}. Side effects: none.
 */
function canvasMetrics(
  responsive: ReturnType<typeof useResponsiveLayout>,
  scriptureSize: ReturnType<typeof selectScriptureSize>,
): CanvasMetrics {
  const railMode = contextRailMode({
    width: responsive.width,
    formFactor: responsive.formFactor,
  });
  const paneWidth = readerPaneWidth(
    contentWidthFor({ width: responsive.width, formFactor: responsive.formFactor }),
    contextRailWidth(railMode),
  );

  return {
    scriptureStep: resolveReadingStep(
      scriptureSize,
      readerScriptureStep(responsive.formFactor, paneWidth),
    ),
    gutter: readerGutterFor(responsive.formFactor, paneWidth),
    columnMaxWidth: columnMaxWidth(responsive.readingMeasure),
    railMode,
    contextIsPinned: railMode !== 'none',
  };
}
