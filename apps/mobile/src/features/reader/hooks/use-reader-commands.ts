/**
 * The reading canvas's commands and its transient surface state.
 *
 * Purpose
 *   `ReaderScreen` is a composition, and rule 5.4.3 caps a function at fifty lines. What
 *   pushed it past that was not markup but behaviour: four `useState` calls and three
 *   navigation callbacks, none of which the markup needs to see the inside of. They live
 *   here, so the screen reads as a description of what is on the page.
 *
 * What belongs here and what does not
 *   Only what changes when the reader *acts*: which sheet is open, whether search is open,
 *   what they typed, and where a tap should navigate to. Data lives in `useReadingCanvas`;
 *   layout lives in the shared rail rule. This hook fetches nothing.
 *
 * Navigation is a callback, never a router
 *   The route supplies `onNavigate`, so the reader renders in a test with no navigator
 *   above it, and a sheet never holds a router. A destination whose book number does not
 *   resolve navigates nowhere rather than throwing the reader onto a 404 — `bookFromNumber`
 *   is the same gate the search results already pass through.
 *
 * Dependencies
 *   `@atlas/shared` for book resolution, `@/api` for the search-hit type, and the reader's
 *   own badge and sheet types.
 */

import { useState } from 'react';

import { bookFromNumber, type CanonicalBook } from '@atlas/shared';

import type { ApiSearchHit } from '@/api';

import type { BadgeSheetTarget } from '../badges';
import type { ReaderAddress } from '../model/reader-address';

import type { OpenSheet } from '../components/ReaderSheets';

/** What the screen needs in order to build its commands. */
export interface ReaderCommandsInput {
  /**
   * Navigate elsewhere in scripture.
   *
   * @param address - Where to go.
   */
  readonly onNavigate: (address: ReaderAddress) => void;
  /** True when a tapped badge opens in the pinned rail rather than in a bottom sheet. */
  readonly contextIsPinned: boolean;
  /** Closes whichever badge is open. From `useBadgeSelection`. */
  readonly closeBadge: () => void;
}

/** Everything `ReaderScreen` drives its surfaces with. */
export interface ReaderCommands {
  /** Which of the reader's own sheets is open. */
  readonly openSheet: OpenSheet;
  /** Open one of them, or `none` to close. */
  readonly setOpenSheet: (sheet: OpenSheet) => void;
  /** Whether the search overlay is up. */
  readonly searchIsOpen: boolean;
  /** Show the search overlay. */
  readonly openSearch: () => void;
  /** Hide it. */
  readonly closeSearch: () => void;
  /** What the reader has typed into it. */
  readonly searchQuery: string;
  /** Record what they typed. */
  readonly setSearchQuery: (query: string) => void;
  /** Go to a book and chapter, closing any open reader sheet first. */
  readonly goTo: (book: CanonicalBook, chapter: number) => void;
  /** Open a search result, closing the overlay. */
  readonly openHit: (hit: ApiSearchHit) => void;
  /** Follow a reference a badge body emitted. */
  readonly openBadgeVerse: (target: BadgeSheetTarget) => void;
}

/**
 * Build the reader's commands.
 *
 * @param input - See {@link ReaderCommandsInput}.
 * @returns See {@link ReaderCommands}. Side effects: holds four pieces of local state and
 *   calls `onNavigate`.
 */
export function useReaderCommands(input: ReaderCommandsInput): ReaderCommands {
  const { onNavigate, contextIsPinned, closeBadge } = input;
  const [openSheet, setOpenSheet] = useState<OpenSheet>('none');
  const [searchIsOpen, setSearchIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return {
    openSheet,
    setOpenSheet,
    searchIsOpen,
    searchQuery,
    setSearchQuery,
    openSearch: () => {
      setSearchIsOpen(true);
    },
    closeSearch: () => {
      setSearchIsOpen(false);
    },
    goTo: (book, chapter) => {
      setOpenSheet('none');
      onNavigate({ book, chapter });
    },
    openHit: (hit) => {
      const book = bookFromNumber(hit.bookNumber);
      setSearchIsOpen(false);
      if (book.ok) onNavigate({ book: book.value, chapter: hit.chapter });
    },
    // The phone sheet covers the bottom half of the screen, so it is dismissed before the
    // move; the rail sits beside the scripture and stays open, which is what lets a reader
    // follow a second cross-reference from the same list.
    openBadgeVerse: (target) => {
      const book = bookFromNumber(target.bookNumber);
      if (!book.ok) return;
      if (!contextIsPinned) closeBadge();
      onNavigate({ book: book.value, chapter: target.chapter });
    },
  };
}
