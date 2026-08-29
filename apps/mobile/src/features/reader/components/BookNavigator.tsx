/**
 * Choosing a book and a chapter, anywhere in the canon.
 *
 * Purpose
 *   The reference picker, ported from `flutter-port-map.md` §7.6: a search field that
 *   normalises away spaces, three testament pills, the book list, and — once a book is
 *   picked — its chapter grid. Two steps, never a wheel.
 *
 * One component, two homes
 *   The same body renders inside the navigator sheet on a phone and inside the permanent
 *   rail on a desktop (the design system's breakpoints decide which). Decision `Q-006` asks
 *   for real parity, and parity is easiest to keep when there is only one implementation.
 *
 * It opens where the reader already is
 *   The current book's chapter grid is expanded from the first render, and the list scrolls
 *   to it once, on mount. Both halves are needed: the grid was already open and it was
 *   1,892 dp below the fold, so a reader in Acts was shown Genesis and had to scroll past
 *   forty-three books to find themselves. Scrolling stops the moment the reader types, so a
 *   filtered list is never yanked out from under them.
 *
 * Enter jumps to the first match
 *   `onSubmitEditing` navigates straight to the top result's first chapter, so typing
 *   `1cor` and pressing Enter is the whole interaction.
 *
 * Dependencies
 *   `@/theme`, `@/theme/runtime`, the book-filter model, and the three parts beside it —
 *   the search field, the testament pills, and the book row. No data fetching.
 */

import { useRef, useState, type JSX } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CanonicalBook } from '@atlas/shared';
import { spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { filterBooks, firstMatchingBook, type TestamentFilter } from '../model/book-filter';

import { BookRow } from './BookRow';
import { BookSearchField } from './BookSearchField';
import { TestamentPills } from './TestamentPills';

/** What the navigator needs. */
export interface BookNavigatorProps {
  /** The book currently open, so it can be marked. */
  readonly currentBookNumber: number;
  readonly currentChapter: number;
  readonly onSelect: (book: CanonicalBook, chapter: number) => void;
}

/** The value `openBookNumber` takes when every book is collapsed. */
const NO_BOOK_OPEN = 0;

/**
 * Render the picker.
 *
 * @param props - See {@link BookNavigatorProps}.
 * @returns The search field, the pills, the book list, and the open book's chapters.
 *
 * Side effects: none beyond `onSelect`.
 */
export function BookNavigator({
  currentBookNumber,
  currentChapter,
  onSelect,
}: BookNavigatorProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [testament, setTestament] = useState<TestamentFilter>('all');
  const [openBookNumber, setOpenBookNumber] = useState(currentBookNumber);

  const books = filterBooks(query, testament);

  return (
    <View style={styles.root} testID="book-navigator">
      <BookSearchField
        value={query}
        onChange={setQuery}
        onSubmit={() => {
          const match = firstMatchingBook(query, testament);
          if (match !== undefined) {
            onSelect(match, 1);
          }
        }}
      />

      <TestamentPills value={testament} onChange={setTestament} />

      <BookList
        books={books}
        query={query}
        scrollToBookNumber={query === '' ? currentBookNumber : undefined}
        openBookNumber={openBookNumber}
        currentBookNumber={currentBookNumber}
        currentChapter={currentChapter}
        onToggle={(toggled) => {
          setOpenBookNumber((open) =>
            open === toggled.canonicalNumber ? NO_BOOK_OPEN : toggled.canonicalNumber,
          );
        }}
        onSelectChapter={onSelect}
      />
    </View>
  );
}

/**
 * The filtered book list, with the open book's chapters inside it.
 *
 * @param props.books - What the filter returned, already ordered.
 * @param props.query - What the reader typed, for the empty-state sentence.
 * @param props.openBookNumber - Which book's chapter grid is showing.
 * @param props.currentBookNumber - The book being read, marked in gold.
 * @param props.currentChapter - The chapter being read.
 * @param props.onToggle - Expand or collapse a book.
 * @param props.onSelectChapter - A chapter tile was pressed.
 * @returns The scrolling list. Side effects: none beyond its callbacks.
 */
function BookList({
  books,
  query,
  scrollToBookNumber,
  openBookNumber,
  currentBookNumber,
  currentChapter,
  onToggle,
  onSelectChapter,
}: {
  readonly books: readonly CanonicalBook[];
  readonly query: string;
  readonly scrollToBookNumber: number | undefined;
  readonly openBookNumber: number;
  readonly currentBookNumber: number;
  readonly currentChapter: number;
  readonly onToggle: (book: CanonicalBook) => void;
  readonly onSelectChapter: (book: CanonicalBook, chapter: number) => void;
}): JSX.Element {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const hasScrolled = useRef(false);

  const revealCurrent = (top: number): void => {
    if (hasScrolled.current || scrollToBookNumber === undefined) return;
    hasScrolled.current = true;
    // A token, not a number: the row above stays partly visible so the list reads as
    // scrolled rather than as starting at this book.
    scrollRef.current?.scrollTo({ y: Math.max(0, top - spacing.md), animated: false });
  };

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
      {books.length === 0 ? (
        <Text style={[styles.empty, { color: theme.ink.secondary }]}>
          No book matches “{query}”.
        </Text>
      ) : null}

      {books.map((book) => (
        <BookRow
          key={book.id}
          book={book}
          expanded={book.canonicalNumber === openBookNumber}
          isCurrent={book.canonicalNumber === currentBookNumber}
          currentChapter={book.canonicalNumber === currentBookNumber ? currentChapter : undefined}
          onToggle={onToggle}
          onSelectChapter={onSelectChapter}
          {...(book.canonicalNumber === scrollToBookNumber ? { onRevealTop: revealCurrent } : {})}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.md },
  // The inset is not slack: without it the last row runs flush into the window edge and is
  // sliced through the middle, which is what a desktop rail did at 1440x900.
  list: { paddingBottom: spacing.xxxl },
  empty: { ...uiText('sm'), paddingVertical: spacing.lg },
});
