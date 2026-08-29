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
 * The chapter-end badge summary
 *   Every badge in the chapter, repeated as a list beneath the last verse
 *   (`design-language.md` §5, `image9.png`). It is inside the same scroll view on purpose: it
 *   is the end of the chapter, not a docked panel, and pillar 1 forbids anything that floats.
 *
 * Dependencies
 *   The reader's theme hook, its scroll model, its badge layer, and `VerseRow`.
 *   No data fetching.
 */

import { forwardRef, type JSX } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { scriptureText, spacing, type ScriptureStep } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { ApiChapter } from '@/api';
import {
  ChapterBadgeSummary,
  type ReaderBadge,
  type SourceAttribution,
  type VerseBadgeMap,
} from '../badges';
import { useCanvasScroll, type ChapterCanvasHandle } from '../hooks/use-canvas-scroll';
import { verseTone, type VerseSelection } from '../model/verse-selection';

import { ChapterFooter } from './ChapterFooter';
import { ChapterTitle } from './ChapterTitle';
import { VerseRow } from './VerseRow';

// The imperative handle is declared beside the hook that fills it, and re-exported here
// because this component is what a parent holds a ref to.
export type { ChapterCanvasHandle } from '../hooks/use-canvas-scroll';

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
  /** Inline badges to splice into each verse, keyed by packed `verseKey`. */
  readonly badges: VerseBadgeMap;
  /** Every badge the chapter delivered, for the summary list beneath the last verse. */
  readonly chapterBadges: readonly ReaderBadge[];
  /** The union of those badges' sources, for one attribution strip (`AI-05`). */
  readonly badgeSources: readonly SourceAttribution[];
  /**
   * Open one badge, from a pill or from a summary row.
   *
   * @param badgeId - The badge's stable id.
   */
  readonly onOpenBadge: (badgeId: string) => void;
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
    const { scrollRef, onScroll, recordVerseTop } = useCanvasScroll(ref);

    return (
      <ScrollView
        ref={scrollRef}
        testID="chapter-canvas"
        style={{ backgroundColor: theme.background.canvas }}
        contentContainerStyle={[styles.content, { paddingHorizontal: props.gutter }]}
        scrollEventThrottle={SCROLL_THROTTLE_MS}
        onScroll={onScroll}
      >
        <View style={[styles.column, { maxWidth: props.columnMaxWidth }]}>
          <ChapterTitle reference={props.chapter.reference} code={props.translationCode} />
          <VerseColumn {...props} onLayoutTop={recordVerseTop} />
          <ChapterBadgeSummary
            badges={props.chapterBadges}
            sources={props.badgeSources}
            onOpen={props.onOpenBadge}
          />
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

/** What one verse row needs, plus the callback that records where it landed. */
type VerseColumnProps = ChapterCanvasProps & {
  /**
   * Record a verse's top edge, so `focusVerse` can scroll to it.
   *
   * @param verseNumber - Which verse.
   * @param top - Its offset within the scroll content.
   */
  readonly onLayoutTop: (verseNumber: number, top: number) => void;
};

/**
 * The verses themselves.
 *
 * @param props - See {@link VerseColumnProps}.
 * @returns One `VerseRow` per verse of the chapter. Side effects: none.
 */
function VerseColumn(props: VerseColumnProps): JSX.Element {
  return (
    <>
      {props.chapter.verses.map((verse) => (
        <VerseRow
          key={verse.verseKey}
          verseNumber={verse.verse}
          text={verse.text}
          tone={verseTone(props.selection, verse.verse)}
          scriptureStep={props.scriptureStep}
          anchors={props.badges.get(verse.verseKey) ?? EMPTY_ANCHORS}
          reduceMotion={props.reduceMotion}
          onPress={props.onSelectVerse}
          onLongPress={props.onHighlightVerse}
          onBadgePress={props.onOpenBadge}
          onLayoutTop={props.onLayoutTop}
        />
      ))}
    </>
  );
}

/** Shared empty list, so an unannotated verse never allocates one per render. */
const EMPTY_ANCHORS: readonly [] = [];

/**
 * How often the scroll position is reported, in milliseconds.
 *
 * 64 ms is roughly four frames: often enough that `focusVerse` computes against a current
 * viewport, rare enough that a drag does not fire a callback per frame.
 */
const SCROLL_THROTTLE_MS = 64;

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
