/**
 * What closes a chapter: attribution, then the way onward.
 *
 * Purpose
 *   Two obligations meet at the bottom of the canvas. The first is legal and ethical — the
 *   reader must be able to see which translation they just read, named in full, and that
 *   name comes from the API rather than from a constant in the client. The second is
 *   navigational: finishing a chapter is the moment a reader most wants the next one, and
 *   making them return to a picker to get it is the detour pillar 2 exists to remove.
 *
 * Attribution
 *   `GET /translations` supplies `name`, `code` and `can_redistribute`. Only what it sends
 *   is rendered; this component never asserts a licence the API did not state. When the
 *   API grows a proper attribution string, it is displayed in place of the name and
 *   nothing else changes. Tracked as `ASSUMPTIONS.md` `R-02`.
 *
 * Dependencies
 *   The reader's theme hook, the metadata typography, and `ReaderButton`.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, metadataText, spacing } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { ReaderButton } from './ReaderButton';

/** What the footer shows. */
export interface ChapterFooterProps {
  /** The translation's full title, from the API. Undefined while the list is loading. */
  readonly translationName: string | undefined;
  readonly translationCode: string;
  readonly onPrevious: (() => void) | undefined;
  readonly onNext: (() => void) | undefined;
  /** Reference of the previous chapter, e.g. `John 2`. */
  readonly previousLabel: string | undefined;
  readonly nextLabel: string | undefined;
}

/**
 * Render the end of a chapter.
 *
 * @param props - See {@link ChapterFooterProps}.
 * @returns The attribution line and the chapter pager. Side effects: none.
 */
export function ChapterFooter({
  translationName,
  translationCode,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
}: ChapterFooterProps): JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.block, { borderTopColor: theme.line.hairline }]}>
      <Text
        testID="chapter-attribution"
        style={[styles.attribution, { color: theme.ink.secondary }]}
      >
        {translationName ?? translationCode}
      </Text>

      <View style={styles.pager}>
        <View style={styles.pagerSide}>
          {onPrevious === undefined || previousLabel === undefined ? null : (
            <ReaderButton
              emphasis="ghost"
              overline="Previous"
              label={previousLabel}
              onPress={onPrevious}
              testID="chapter-previous"
              accessibilityLabel={`Previous chapter, ${previousLabel}`}
            />
          )}
        </View>
        <View style={[styles.pagerSide, styles.pagerEnd]}>
          {onNext === undefined || nextLabel === undefined ? null : (
            <ReaderButton
              emphasis="ghost"
              overline="Next"
              label={nextLabel}
              onPress={onNext}
              align="end"
              testID="chapter-next"
              accessibilityLabel={`Next chapter, ${nextLabel}`}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: borderWidth.hairline,
    gap: spacing.lg,
  },
  attribution: { ...metadataText('xs'), textAlign: 'center' },
  // `alignItems: 'stretch'` on both sides, so the two controls' hit areas are the mirror
  // image of each other. The Next control right-aligns its own text instead (`align="end"`),
  // which is what makes the pair look balanced *and* measure balanced.
  pager: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  pagerSide: { flex: 1 },
  pagerEnd: { alignItems: 'stretch' },
});
