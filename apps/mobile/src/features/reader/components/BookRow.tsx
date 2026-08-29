/**
 * One book in the navigator, with its chapters underneath when it is open.
 *
 * Purpose
 *   Step two of the two-step picker (`flutter-port-map.md` §7.6). Tapping a book expands
 *   its chapter grid in place rather than pushing a screen, so choosing `1 Corinthians 13`
 *   is two taps without ever losing sight of the list.
 *
 * The current book is marked, not merely tinted
 *   Gold text alone was not enough to find: the row carried no `aria-current`, no selected
 *   state and a transparent background, so a reader in Acts opening the picker saw a list
 *   that looked exactly like a list of sixty-six identical rows. It now carries a fill, a
 *   left rule, and the ARIA that says which one it is.
 *
 * The chapter count is shown, not hidden
 *   The prototype's book tiles carried it and it earns its space: a reader deciding whether
 *   to open Psalms wants to know it is 150 chapters before they tap.
 *
 * Dependencies
 *   `@/theme`, `@/theme/runtime`, `@atlas/shared` for the book row type, and `ChapterGrid`.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { CanonicalBook } from '@atlas/shared';
import { borderWidth, radius, size, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { tint } from '../styles/tint';

import { ChapterGrid } from './ChapterGrid';

/** What one book row needs. */
export interface BookRowProps {
  readonly book: CanonicalBook;
  /** True when this book's chapter grid is showing. */
  readonly expanded: boolean;
  /** True when this is the book currently being read. */
  readonly isCurrent: boolean;
  /** The chapter open in this book, when it is the current one. */
  readonly currentChapter: number | undefined;
  readonly onToggle: (book: CanonicalBook) => void;
  readonly onSelectChapter: (book: CanonicalBook, chapter: number) => void;
  /**
   * Reports this row's top edge inside the list, so the list can scroll to it.
   *
   * Only the current book is given one — a callback on all sixty-six rows would fire
   * sixty-six times on every layout pass for one number the list wanted once.
   */
  readonly onRevealTop?: ((top: number) => void) | undefined;
}

/** Opacity of the fill behind the book the reader is in. */
const CURRENT_FILL_ALPHA = 0.12;

/**
 * Render one book.
 *
 * @param props - See {@link BookRowProps}.
 * @returns The row, and its chapter grid when expanded.
 *
 * Side effects: none beyond its callbacks.
 */
export function BookRow({
  book,
  expanded,
  isCurrent,
  currentChapter,
  onToggle,
  onSelectChapter,
  onRevealTop,
}: BookRowProps): JSX.Element {
  const theme = useTheme();

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => {
        onRevealTop?.(event.nativeEvent.layout.y);
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, selected: isCurrent }}
        aria-expanded={expanded}
        // `aria-current="page"` is the attribute a screen reader uses to answer "which of
        // these am I on"; react-native-web derives none of this from `accessibilityState`.
        {...(isCurrent ? { 'aria-current': 'page' as const } : {})}
        accessibilityLabel={`${book.name}, ${String(book.chapterCount)} chapters${
          isCurrent ? ', currently reading' : ''
        }`}
        testID={`book-row-${book.id}`}
        onPress={() => {
          onToggle(book);
        }}
        style={[
          styles.row,
          isCurrent
            ? {
                backgroundColor: tint(theme.accent.gold, CURRENT_FILL_ALPHA),
                borderLeftColor: theme.accent.gold,
              }
            : styles.rowResting,
        ]}
      >
        <Text style={[styles.name, { color: isCurrent ? theme.accent.gold : theme.ink.primary }]}>
          {book.name}
        </Text>
        <Text style={[styles.count, { color: theme.ink.tertiary }]}>{book.chapterCount}</Text>
      </Pressable>

      {expanded ? (
        <ChapterGrid
          bookName={book.name}
          chapterCount={book.chapterCount}
          currentChapter={currentChapter}
          onSelect={(chapter) => {
            onSelectChapter(book, chapter);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: size.tapTarget,
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
    borderLeftWidth: borderWidth.focus,
  },
  // The resting row reserves the same left rule the current row paints, so nothing shifts
  // sideways when the reader moves from one book to another.
  rowResting: { borderLeftColor: 'transparent' },
  name: { ...uiText('md', 'medium'), flexShrink: 1 },
  count: uiText('xs'),
});
