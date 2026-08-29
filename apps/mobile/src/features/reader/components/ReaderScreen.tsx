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
 * Navigation
 *   Expo Router is reached only through the `onNavigate` callback the route supplies, so
 *   this component renders in a test without a navigator above it.
 */

import { useRef, useState, type JSX } from 'react';
import { StyleSheet, View } from 'react-native';

import { bookFromNumber, type CanonicalBook } from '@atlas/shared';
import type { ApiSearchHit } from '@/api';
import { ContextRailShell } from '@/components/split/ContextRailShell';
import { useTheme } from '@/theme/runtime';

import { useReadingCanvas } from '../hooks/use-reading-canvas';
import { nextChapter, previousChapter, type ReaderAddress } from '../model/reader-address';
import { selectedVerseView } from '../model/verse-view';

import type { ChapterCanvasHandle } from './ChapterCanvas';
import { ContextPanel } from './ContextPanel';
import { ReaderPane } from './ReaderPane';
import { ReaderSheets, type OpenSheet } from './ReaderSheets';
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
  const canvasRef = useRef<ChapterCanvasHandle>(null);
  const [openSheet, setOpenSheet] = useState<OpenSheet>('none');
  const [searchIsOpen, setSearchIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const goTo = (book: CanonicalBook, chapter: number): void => {
    setOpenSheet('none');
    onNavigate({ book, chapter });
  };

  const openHit = (hit: ApiSearchHit): void => {
    const book = bookFromNumber(hit.bookNumber);
    setSearchIsOpen(false);
    if (book.ok) onNavigate({ book: book.value, chapter: hit.chapter });
  };

  const verse = selectedVerseView(address, canvas.selection.selection, canvas.chapterQuery.data);
  const closeVerse = canvas.selection.clearSelection;

  return (
    <View
      testID="reader-screen"
      style={[styles.root, { backgroundColor: theme.background.canvas }]}
    >
      <ContextRailShell
        railTestID="reader-context-rail"
        handleAccessibilityLabel="Resize the context rail"
        rail={
          <ContextPanel reference={verse?.reference} text={verse?.text} onClose={closeVerse} />
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
            onOpenSheet={setOpenSheet}
            onOpenSearch={() => {
              setSearchIsOpen(true);
            }}
          />
          <VerseDock verse={canvas.contextIsPinned ? undefined : verse} onClose={closeVerse} />
        </View>
      </ContextRailShell>

      <ReaderSheets
        open={openSheet}
        {...whereOf(address)}
        resolvedStep={canvas.scriptureStep}
        onClose={() => {
          setOpenSheet('none');
        }}
        onNavigate={goTo}
      />

      <SearchOverlay
        visible={searchIsOpen}
        query={searchQuery}
        onChangeQuery={setSearchQuery}
        onClose={() => {
          setSearchIsOpen(false);
        }}
        onOpenHit={openHit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // The dock is a sibling of the reading column, not a layer over it: the canvas shrinks
  // when a verse opens, so every verse still on screen is still tappable.
  column: { flex: 1 },
});
