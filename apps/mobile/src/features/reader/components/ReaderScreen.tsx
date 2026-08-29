/**
 * The reading canvas, assembled.
 *
 * Purpose
 *   This is the product, and this file is only its arrangement: a reading column, the
 *   context rail beside it, and the surfaces that may cover it. The queries, the selection
 *   and the layout numbers are `useReadingCanvas`; the column is `ReaderPane`; every rule is
 *   a tested module. Nothing here computes anything.
 *
 * Layout
 *   `ContextRailShell` decides whether there is room for a rail, from the same rule the
 *   reader asks (`@/components/split/context-rail-mode`). Below 600 dp a selected verse
 *   docks under the canvas; from 600 dp it opens in the rail; from 1100 dp that rail can be
 *   dragged. `Q-006`, port-map risk #5.
 *
 * Pillar 1
 *   Nothing floats over scripture: the header sits above the canvas rather than on it, the
 *   rail sits beside it, and the sheets and the search overlay are surfaces the reader
 *   deliberately opened.
 *
 * A tapped badge has two homes, never both
 *   Below 600 dp it opens a bottom sheet that leaves the scripture above it visible
 *   (`design-language.md` §4). From 600 dp the rail already exists, so the same body renders
 *   *there*, beside the text, and no sheet is mounted. `contextIsPinned` decides, and it comes
 *   from the same rule the layout itself uses — so the two can never both be showing.
 *
 * Navigation
 *   Expo Router is reached only through the `onNavigate` callback the route supplies, so
 *   this component renders in a test without a navigator above it. The three commands that
 *   use it, and the four pieces of surface state beside them, are `useReaderCommands` —
 *   which is what keeps this function a description of the page rather than half behaviour.
 */

import { useRef, type JSX } from 'react';
import { StyleSheet, View } from 'react-native';

import { ContextRailShell } from '@/components/split/ContextRailShell';
import { useTheme } from '@/theme/runtime';

import { BadgeSheet } from '../badges';
import { useReaderCommands, type ReaderCommands } from '../hooks/use-reader-commands';
import { useReadingCanvas, type ReadingCanvas } from '../hooks/use-reading-canvas';
import { nextChapter, previousChapter, type ReaderAddress } from '../model/reader-address';
import { selectedVerseView } from '../model/verse-view';

import type { ChapterCanvasHandle } from './ChapterCanvas';
import { ContextPanel } from './ContextPanel';
import { ReaderPane } from './ReaderPane';
import { ReaderSheets } from './ReaderSheets';
import { SearchOverlay } from './SearchOverlay';
import { VerseDock } from './VerseDock';

/** What the reader screen needs from its route. */
export interface ReaderScreenProps {
  /** The validated address to read. */
  readonly address: ReaderAddress;
  /**
   * Navigate elsewhere in scripture.
   *
   * @param address - Where to go.
   */
  readonly onNavigate: (address: ReaderAddress) => void;
}

/**
 * Which book and chapter the navigator should mark as current.
 *
 * @param address - Where the reader is.
 * @returns The two props the navigator sheet takes. Side effects: none.
 */
function whereOf(address: ReaderAddress): {
  readonly currentBookNumber: number;
  readonly currentChapter: number;
} {
  return { currentBookNumber: address.book.canonicalNumber, currentChapter: address.chapter };
}

/**
 * Render the reading canvas.
 *
 * @param props - See {@link ReaderScreenProps}.
 * @returns The reading column, the context rail, and the surfaces over them.
 *
 * Side effects: fetches through `useReadingCanvas`.
 */
export function ReaderScreen({ address, onNavigate }: ReaderScreenProps): JSX.Element {
  const theme = useTheme();
  const canvas = useReadingCanvas(address);
  const commands = useReaderCommands({
    onNavigate,
    contextIsPinned: canvas.contextIsPinned,
    closeBadge: canvas.badgeSelection.close,
  });
  const parts = { address, canvas, commands, onNavigate };

  return (
    <View
      testID="reader-screen"
      style={[styles.root, { backgroundColor: theme.background.canvas }]}
    >
      <ReadingArea {...parts} />
      <ReaderSurfaces {...parts} />
    </View>
  );
}

/** What both halves of the screen are assembled from. */
interface ReaderParts {
  readonly address: ReaderAddress;
  readonly canvas: ReadingCanvas;
  readonly commands: ReaderCommands;
  readonly onNavigate: (address: ReaderAddress) => void;
}

/**
 * The scripture and the context rail beside it — everything the reader reads.
 *
 * @param props - See {@link ReaderParts}.
 * @returns The rail shell wrapping the reading column and its dock. Side effects: none.
 */
function ReadingArea({ address, canvas, commands, onNavigate }: ReaderParts): JSX.Element {
  const canvasRef = useRef<ChapterCanvasHandle>(null);
  const verse = selectedVerseView(address, canvas.selection.selection, canvas.chapterQuery.data);
  const closeVerse = canvas.selection.clearSelection;

  return (
    <ContextRailShell
      railTestID="reader-context-rail"
      handleAccessibilityLabel="Resize the context rail"
      rail={
        <ContextPanel
          reference={verse?.reference}
          text={verse?.text}
          onClose={closeVerse}
          badge={canvas.badgeSelection.badge}
          onCloseBadge={canvas.badgeSelection.close}
          onOpenBadgeVerse={commands.openBadgeVerse}
        />
      }
    >
      <View style={styles.column}>
        <ReaderPane
          ref={canvasRef}
          address={address}
          canvas={canvas}
          previous={previousChapter(address)}
          next={nextChapter(address)}
          onNavigate={onNavigate}
          onOpenSheet={commands.setOpenSheet}
          onOpenSearch={commands.openSearch}
          onOpenBadge={canvas.badgeSelection.open}
        />
        <VerseDock verse={canvas.contextIsPinned ? undefined : verse} onClose={closeVerse} />
      </View>
    </ContextRailShell>
  );
}

/**
 * The three surfaces a reader may deliberately open over the canvas (pillar 1).
 *
 * @param props - See {@link ReaderParts}.
 * @returns The badge sheet, the reader's own sheets, and the search overlay. Side effects:
 *   none.
 */
function ReaderSurfaces({ address, canvas, commands }: ReaderParts): JSX.Element {
  return (
    <>
      <BadgeSheet
        badge={canvas.contextIsPinned ? undefined : canvas.badgeSelection.badge}
        onClose={canvas.badgeSelection.close}
        onOpenVerse={commands.openBadgeVerse}
      />

      <ReaderSheets
        open={commands.openSheet}
        {...whereOf(address)}
        resolvedStep={canvas.scriptureStep}
        onClose={() => {
          commands.setOpenSheet('none');
        }}
        onNavigate={commands.goTo}
      />

      <SearchOverlay
        visible={commands.searchIsOpen}
        query={commands.searchQuery}
        onChangeQuery={commands.setSearchQuery}
        onClose={commands.closeSearch}
        onOpenHit={commands.openHit}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // The dock is a sibling of the reading column, not a layer over it: the canvas shrinks
  // when a verse opens, so every verse still on screen is still tappable.
  column: { flex: 1 },
});
