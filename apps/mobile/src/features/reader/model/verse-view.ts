/**
 * The one open verse, as a detail surface needs it.
 *
 * Purpose
 *   Selection is a verse *number* in the canvas and a packed `verseKey` in the store; a
 *   detail panel needs neither, it needs a reference and a sentence. Doing that join here
 *   rather than in the component keeps `ReaderScreen` a composition, and makes "the sheet
 *   is headed with the verse that was tapped" a property that can be tested in Node — which
 *   matters, because a panel wired to a stale reference is exactly how the prototype showed
 *   one verse's study note under another verse's heading (`flutter-port-map.md` §7.3).
 *
 * Dependencies
 *   `@atlas/shared` for the reference formatter, `@/api` for the chapter shape, and the
 *   reader's own address and selection models. No React.
 */

import { formatVerseReference } from '@atlas/shared';

import type { ApiChapter } from '@/api';

import type { ReaderAddress } from './reader-address';
import type { VerseSelection } from './verse-selection';

/** Everything a verse detail surface renders. */
export interface VerseView {
  /** The full reference, e.g. `Acts 1:8`. */
  readonly reference: string;
  /** The verse text, exactly as the API sent it. */
  readonly text: string;
  /** The 1-based verse number, so a caller can scroll to it. */
  readonly verse: number;
}

/**
 * The open verse, if one is open and its text has arrived.
 *
 * @param address - Where the reader is.
 * @param selection - Which verse is open.
 * @param chapter - The loaded chapter, or `undefined` while it is still in flight.
 * @returns The view, or `undefined` when nothing is open, the chapter has not landed, or
 *   the selected number is not in it — which happens for one render after a chapter change,
 *   and must show nothing rather than the wrong verse. Side effects: none.
 */
export function selectedVerseView(
  address: ReaderAddress,
  selection: VerseSelection,
  chapter: ApiChapter | undefined,
): VerseView | undefined {
  const verse = selection.selected;
  if (verse === null || chapter === undefined) return undefined;

  const found = chapter.verses.find((candidate) => candidate.verse === verse);
  if (found === undefined) return undefined;

  return {
    reference: formatVerseReference({ book: address.book, chapter: address.chapter, verse }),
    text: found.text,
    verse,
  };
}
