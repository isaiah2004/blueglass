/**
 * Bible tab — the way into the reading canvas.
 *
 * Purpose
 *   Tapping Bible opens scripture. It used to open a plan screen with a "Continue" card on
 *   it, which put the product two taps from its own front door and left `reader-screen`
 *   unreachable from the tab bar; `e2e/walkthrough/03-reader.spec.ts` states the contract
 *   this file now keeps — "a reader who taps Bible and gets a stub screen has no route into
 *   the product at all".
 *
 * Where it opens
 *   The reader's last position, from the shared reader store, which `useReadingCanvas`
 *   writes every time a chapter is read. A reader who has not opened anything yet goes to
 *   the start of the MVP plan — thirty days through Acts (`docs/product/prd.md`, "MVP
 *   Phase") — rather than to the store's own Genesis 1 default, which means "the first
 *   chapter of the canon", not "where this reader belongs".
 *
 * Why a redirect rather than a second reader
 *   The reader route is `app/(tabs)/read/[book]/[chapter].tsx`, inside this tab group so it
 *   keeps the tab bar and the nav rail. Rendering a *second* reader here would put two
 *   `reader-screen` nodes in the document and give the reader a chapter with no address in
 *   the URL — no bookmark, no share, no Back.
 */

import { Redirect } from 'expo-router';
import type { JSX } from 'react';

import { bookFromAny } from '@atlas/shared';
import { DEFAULT_READER_ADDRESS, selectAddress, useReader } from '@/stores';

/** Where a reader with no history begins. */
const PLAN_START = { book: 'acts', chapter: '1' } as const;

/**
 * The reader's resume point, as route parameters.
 *
 * @param address - The store's current address.
 * @returns The book slug and chapter to open. Side effects: none.
 */
function resumeParams(address: {
  readonly book: string;
  readonly chapter: number;
}): { readonly book: string; readonly chapter: string } {
  const isUntouched =
    address.book === DEFAULT_READER_ADDRESS.book &&
    address.chapter === DEFAULT_READER_ADDRESS.chapter;
  if (isUntouched) return PLAN_START;

  const book = bookFromAny(address.book);
  if (!book.ok) return PLAN_START;
  return { book: book.value.id, chapter: String(address.chapter) };
}

/**
 * Send the reader to wherever they left off.
 *
 * @returns A redirect to the reader route. Side effects: navigates.
 */
export default function BibleScreen(): JSX.Element {
  const address = useReader(selectAddress);

  return <Redirect href={{ pathname: '/read/[book]/[chapter]', params: resumeParams(address) }} />;
}
