/**
 * The chapter tiles of one book.
 *
 * Purpose
 *   Step two of the reference picker `flutter-port-map.md` §7.6 asks to be ported
 *   faithfully: a grid of small tiles rather than a wheel or a long list, because a reader
 *   choosing Psalm 119 should not have to scroll past 118 rows to reach it.
 *
 * Sizing
 *   Tiles are `size.tapTarget` square, which is the 44 dp minimum touch area, so the grid
 *   is usable with a thumb without any per-tile hit slop.
 *
 * Dependencies
 *   The reader's theme hook and the radius, size, spacing and typography tokens.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidth, radius, size, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { tint } from '../styles/tint';

/** What the grid needs. */
export interface ChapterGridProps {
  readonly bookName: string;
  readonly chapterCount: number;
  /** The chapter currently open, when it is in this book. */
  readonly currentChapter: number | undefined;
  readonly onSelect: (chapter: number) => void;
}

/** Opacity of the fill behind the open chapter's tile. */
const CURRENT_FILL_ALPHA = 0.16;

/**
 * Render the chapter tiles.
 *
 * @param props - See {@link ChapterGridProps}.
 * @returns A wrapping grid of tiles. Side effects: none beyond `onSelect`.
 */
export function ChapterGrid({
  bookName,
  chapterCount,
  currentChapter,
  onSelect,
}: ChapterGridProps): JSX.Element {
  const theme = useTheme();
  const chapters = Array.from({ length: chapterCount }, (_unused, index) => index + 1);

  return (
    <View style={styles.grid} testID="chapter-grid">
      {chapters.map((chapter) => {
        const isCurrent = chapter === currentChapter;
        return (
          <Pressable
            key={chapter}
            accessibilityRole="button"
            accessibilityLabel={`${bookName} ${String(chapter)}`}
            accessibilityState={{ selected: isCurrent }}
            testID={`chapter-tile-${String(chapter)}`}
            onPress={() => {
              onSelect(chapter);
            }}
            style={[
              styles.tile,
              {
                borderColor: isCurrent ? theme.accent.goldDim : theme.line.hairline,
                backgroundColor: isCurrent
                  ? tint(theme.accent.gold, CURRENT_FILL_ALPHA)
                  : theme.background.card,
              },
            ]}
          >
            <Text
              style={[styles.label, { color: isCurrent ? theme.accent.gold : theme.ink.secondary }]}
            >
              {chapter}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  tile: {
    width: size.tapTarget,
    height: size.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.hairline,
    borderRadius: radius.control,
  },
  label: uiText('sm', 'medium'),
});
