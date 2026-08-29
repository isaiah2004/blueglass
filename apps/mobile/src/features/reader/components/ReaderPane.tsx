/**
 * The header and the canvas, as one column.
 *
 * Purpose
 *   Whatever the window width, the reader is a control bar above a column of scripture.
 *   Only what sits *beside* that column changes — nothing on a phone, a draggable navigator
 *   rail on a desktop. Naming the column separately is what lets `ReaderScreen` place it in
 *   either arrangement without duplicating it.
 *
 * Pillar 1
 *   The header is above the canvas, not on it. Nothing here floats over scripture.
 *
 * Dependencies
 *   The reading-canvas view model, `ReaderHeader` and `ReaderBody`. No queries, no stores.
 */

import { forwardRef, type JSX } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ReadingCanvas } from '../hooks/use-reading-canvas';
import { readerReference, type ReaderAddress } from '../model/reader-address';

import type { ChapterCanvasHandle } from './ChapterCanvas';
import { ReaderBody } from './ReaderBody';
import { ReaderHeader } from './ReaderHeader';
import type { OpenSheet } from './ReaderSheets';

/** What the pane needs. */
export interface ReaderPaneProps {
  readonly address: ReaderAddress;
  readonly canvas: ReadingCanvas;
  /** The chapter before this one, or `undefined` at Genesis 1. */
  readonly previous: ReaderAddress | undefined;
  /** The chapter after this one, or `undefined` at Revelation 22. */
  readonly next: ReaderAddress | undefined;
  readonly onNavigate: (address: ReaderAddress) => void;
  /** Open one of the reader's sheets. */
  readonly onOpenSheet: (sheet: OpenSheet) => void;
  /** Open the scripture search overlay. */
  readonly onOpenSearch: () => void;
  /**
   * Open one inline badge — from a pill in the text or from the chapter-end summary.
   *
   * @param badgeId - The badge's stable id.
   */
  readonly onOpenBadge: (badgeId: string) => void;
}

/**
 * Render the reading column.
 *
 * @param props - See {@link ReaderPaneProps}.
 * @param ref - Forwarded to the canvas, so a parent can focus a verse.
 * @returns The header above the body.
 *
 * Side effects: none beyond its callbacks.
 */
export const ReaderPane = forwardRef<ChapterCanvasHandle, ReaderPaneProps>(function ReaderPane(
  { address, canvas, previous, next, onNavigate, onOpenSheet, onOpenSearch, onOpenBadge },
  ref,
): JSX.Element {
  const openNavigator = (): void => {
    onOpenSheet('navigator');
  };
  const openTranslations = (): void => {
    onOpenSheet('translations');
  };
  const goToPrevious =
    previous === undefined
      ? undefined
      : (): void => {
          onNavigate(previous);
        };
  const goToNext =
    next === undefined
      ? undefined
      : (): void => {
          onNavigate(next);
        };

  return (
    <View style={styles.pane}>
      <ReaderHeader
        reference={readerReference(address)}
        translationCode={canvas.translationCode}
        reduceMotion={canvas.reduceMotion}
        onOpenNavigator={openNavigator}
        onOpenTranslations={openTranslations}
        onOpenSearch={onOpenSearch}
        onOpenDisplay={() => {
          onOpenSheet('display');
        }}
      />

      <ReaderBody
        ref={ref}
        query={canvas.chapterQuery}
        selection={canvas.selection.selection}
        scriptureStep={canvas.scriptureStep}
        gutter={canvas.gutter}
        columnMaxWidth={canvas.columnMaxWidth}
        reduceMotion={canvas.reduceMotion}
        badges={canvas.badgeView.anchors}
        chapterBadges={canvas.badgeView.badges}
        badgeSources={canvas.badgeSources}
        onOpenBadge={onOpenBadge}
        translationCode={canvas.translationCode}
        translationName={canvas.translationName}
        onSelectVerse={canvas.selection.selectVerse}
        onHighlightVerse={canvas.selection.highlightVerse}
        onPrevious={goToPrevious}
        onNext={goToNext}
        previousLabel={previous === undefined ? undefined : readerReference(previous)}
        nextLabel={next === undefined ? undefined : readerReference(next)}
        onRetry={() => {
          void canvas.chapterQuery.refetch();
        }}
        onOpenNavigator={openNavigator}
        onOpenTranslations={openTranslations}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  pane: { flex: 1 },
});
