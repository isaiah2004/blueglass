/**
 * The scrolling column of scripture — the reading canvas itself.
 *
 * Purpose
 *   Pillar 1 is a pristine reading canvas: nothing floats over scripture. This component
 *   is therefore only verses, a chapter title, and the attribution beneath them. Every
 *   control lives in the header above it or in a sheet the reader deliberately opened.
 *
 * Why a ScrollView and not a virtualised list
 *   The longest chapter in the canon is Psalm 119 at 176 verses, which is well inside what
 *   a plain `ScrollView` renders without complaint. A `FlatList` would buy nothing and
 *   cost two things the canvas needs: uninterrupted drag-selection of text on the web
 *   (`flutter-port-map.md` §7.7) and correct `onLayout` offsets for scroll-to-verse.
 *
 * Scroll behaviour
 *   The canvas records each row's top edge and the live scroll metrics, so
 *   `model/reader-scroll` can place a focused verse 18 % down the viewport. It never
 *   scrolls on its own: `flutter-port-map.md` §7.2's rule is that a reader who scrolled up
 *   is never yanked.
 *
 * Dependencies
 *   The reader's theme hook, its scroll model, and `VerseRow`. No data fetching.
 */

import { forwardRef, useImperativeHandle, useRef, type JSX } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { scriptureText, spacing, type ScriptureStep } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { ApiChapter } from '@/api';
import type { VerseBadgeMap } from '../hooks/use-verse-badges';
import { offsetToFocusVerse, type ScrollMetrics } from '../model/reader-scroll';
import { verseTone, type VerseSelection } from '../model/verse-selection';

import { ChapterFooter } from './ChapterFooter';
import { ChapterTitle } from './ChapterTitle';
import { VerseRow } from './VerseRow';

/** What a parent may ask the canvas to do. */
export interface ChapterCanvasHandle {
  /**
   * Scroll a verse to 18 % of the viewport.
   *
   * @param verseNumber - The verse to bring into view.
   */
  readonly focusVerse: (verseNumber: number) => void;
}

/** What the canvas needs to render. */
export interface ChapterCanvasProps {
  readonly chapter: ApiChapter;
  readonly selection: VerseSelection;
  readonly scriptureStep: ScriptureStep;
  /** Horizontal padding beside the column, from `readerGutterFor`. */
  readonly gutter: number;
  /** The column's `maxWidth`, or `undefined` when uncapped. */
  readonly columnMaxWidth: number | undefined;
  readonly reduceMotion: boolean;
  /** Inline badges to splice into each verse, keyed by verse number. */
  readonly badges: VerseBadgeMap;
  /** Full title of the translation, shown as the attribution. */
  readonly translationName: string | undefined;
  readonly translationCode: string;
  readonly onSelectVerse: (verseNumber: number) => void;
  readonly onHighlightVerse: (verseNumber: number) => void;
  /** Footer navigation. Undefined at the two ends of the canon. */
  readonly onPrevious: (() => void) | undefined;
  readonly onNext: (() => void) | undefined;
  readonly previousLabel: string | undefined;
  readonly nextLabel: string | undefined;
}

/**
 * Render the chapter.
 *
 * @param props - See {@link ChapterCanvasProps}.
 * @param ref - Exposes {@link ChapterCanvasHandle}.
 * @returns The scrolling canvas.
 *
 * Side effects: none beyond the callbacks it is given.
 */
export const ChapterCanvas = forwardRef<ChapterCanvasHandle, ChapterCanvasProps>(
  function ChapterCanvas(props, ref): JSX.Element {
    const theme = useTheme();
    const scrollRef = useRef<ScrollView>(null);
    const verseTops = useRef(new Map<number, number>());
    const metrics = useRef<ScrollMetrics>({ offsetY: 0, contentHeight: 0, viewportHeight: 0 });

    useImperativeHandle(ref, () => ({
      focusVerse: (verseNumber: number) => {
        const top = verseTops.current.get(verseNumber);
        if (top === undefined) {
          return;
        }
        scrollRef.current?.scrollTo({
          y: offsetToFocusVerse(top, metrics.current),
          animated: true,
        });
      },
    }));

    return (
      <ScrollView
        ref={scrollRef}
        testID="chapter-canvas"
        style={{ backgroundColor: theme.background.canvas }}
        contentContainerStyle={[styles.content, { paddingHorizontal: props.gutter }]}
        scrollEventThrottle={64}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          metrics.current = {
            offsetY: contentOffset.y,
            contentHeight: contentSize.height,
            viewportHeight: layoutMeasurement.height,
          };
        }}
      >
        <View style={[styles.column, { maxWidth: props.columnMaxWidth }]}>
          <ChapterTitle reference={props.chapter.reference} code={props.translationCode} />

          {props.chapter.verses.map((verse) => (
            <VerseRow
              key={verse.verseKey}
              verseNumber={verse.verse}
              text={verse.text}
              tone={verseTone(props.selection, verse.verse)}
              scriptureStep={props.scriptureStep}
              anchors={props.badges.get(verse.verse) ?? EMPTY_ANCHORS}
              reduceMotion={props.reduceMotion}
              onPress={props.onSelectVerse}
              onLongPress={props.onHighlightVerse}
              onLayoutTop={(verseNumber, top) => {
                verseTops.current.set(verseNumber, top);
              }}
            />
          ))}

          <ChapterFooter
            translationName={props.translationName}
            translationCode={props.translationCode}
            onPrevious={props.onPrevious}
            onNext={props.onNext}
            previousLabel={props.previousLabel}
            nextLabel={props.nextLabel}
          />
        </View>
      </ScrollView>
    );
  },
);

/** Shared empty list, so an unannotated verse never allocates one per render. */
const EMPTY_ANCHORS: readonly [] = [];

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
    // A chapter must be able to scroll clear of the tab bar and the home indicator, and
    // the last verse should not sit flush against the bottom edge of the glass.
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },
  column: {
    width: '100%',
    // A line of the serif at its largest reading size still breaks comfortably inside the
    // cap `@/theme`'s `readingMeasure` fixes.
    minHeight: scriptureText('lg').lineHeight,
  },
});
