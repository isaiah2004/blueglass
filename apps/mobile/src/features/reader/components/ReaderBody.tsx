/**
 * Whichever of the reader's four content states applies.
 *
 * Purpose
 *   Exactly one of these renders at a time: the skeleton, a failure, an empty chapter, or
 *   the scripture. Gathering the choice into one component keeps `ReaderScreen` a
 *   composition of chrome and sheets, and — more importantly — makes the four states
 *   mutually exclusive by construction rather than by four independent conditionals that
 *   could all be true at once.
 *
 * Dependencies
 *   The reader's chapter query type, its status copy, and the canvas, skeleton and message
 *   components. No navigation, no settings store.
 */

import { forwardRef, type JSX } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AtlasQueryResult, ApiChapter } from '@/api';
import type { ScriptureStep } from '@/theme';

import type { SourceAttribution, ReaderBadge, VerseBadgeMap } from '../badges';
import { EMPTY_CHAPTER_COPY, readerStatusCopy } from '../model/reader-status';
import type { VerseSelection } from '../model/verse-selection';

import { ChapterCanvas, type ChapterCanvasHandle } from './ChapterCanvas';
import { ChapterSkeleton } from './ChapterSkeleton';
import { ReaderMessage } from './ReaderMessage';

/** What the body needs. */
export interface ReaderBodyProps {
  readonly query: AtlasQueryResult<ApiChapter>;
  readonly selection: VerseSelection;
  readonly scriptureStep: ScriptureStep;
  readonly gutter: number;
  readonly columnMaxWidth: number | undefined;
  readonly reduceMotion: boolean;
  readonly badges: VerseBadgeMap;
  readonly chapterBadges: readonly ReaderBadge[];
  readonly badgeSources: readonly SourceAttribution[];
  readonly onOpenBadge: (badgeId: string) => void;
  readonly translationCode: string;
  readonly translationName: string | undefined;
  readonly onSelectVerse: (verseNumber: number) => void;
  readonly onHighlightVerse: (verseNumber: number) => void;
  readonly onPrevious: (() => void) | undefined;
  readonly onNext: (() => void) | undefined;
  readonly previousLabel: string | undefined;
  readonly nextLabel: string | undefined;
  /** Retry the read, for the failures where that can help. */
  readonly onRetry: () => void;
  /** Open the navigator, for a wrong address. */
  readonly onOpenNavigator: () => void;
  /** Open the translation switcher, for an empty chapter. */
  readonly onOpenTranslations: () => void;
}

/**
 * Render the current content state.
 *
 * @param props - See {@link ReaderBodyProps}.
 * @param ref - Forwarded to the canvas, so a parent can focus a verse.
 * @returns One of the four states.
 *
 * Side effects: none beyond its callbacks.
 */
export const ReaderBody = forwardRef<ChapterCanvasHandle, ReaderBodyProps>(
  function ReaderBody(props, ref): JSX.Element {
    const { query } = props;

    if (query.isPending) {
      return (
        <View style={[styles.padded, { paddingHorizontal: props.gutter }]}>
          <ChapterSkeleton reduceMotion={props.reduceMotion} />
        </View>
      );
    }

    if (query.isError) {
      const copy = readerStatusCopy(query.error.failure);
      return (
        <ReaderMessage
          {...copy}
          reduceMotion={props.reduceMotion}
          onAction={copy.tone === 'notFound' ? props.onOpenNavigator : props.onRetry}
        />
      );
    }

    if (query.data.verses.length === 0) {
      return (
        <ReaderMessage
          {...EMPTY_CHAPTER_COPY}
          reduceMotion={props.reduceMotion}
          onAction={props.onOpenTranslations}
        />
      );
    }

    return (
      <ChapterCanvas
        ref={ref}
        chapter={query.data}
        selection={props.selection}
        scriptureStep={props.scriptureStep}
        gutter={props.gutter}
        columnMaxWidth={props.columnMaxWidth}
        reduceMotion={props.reduceMotion}
        badges={props.badges}
        chapterBadges={props.chapterBadges}
        badgeSources={props.badgeSources}
        onOpenBadge={props.onOpenBadge}
        translationCode={props.translationCode}
        translationName={props.translationName}
        onSelectVerse={props.onSelectVerse}
        onHighlightVerse={props.onHighlightVerse}
        onPrevious={props.onPrevious}
        onNext={props.onNext}
        previousLabel={props.previousLabel}
        nextLabel={props.nextLabel}
      />
    );
  },
);

const styles = StyleSheet.create({
  padded: { flex: 1 },
});
