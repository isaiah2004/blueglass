/**
 * The development-only badge preview.
 *
 * Purpose
 *   M1 renders scripture; M2 delivers the enrichment that annotates it. Until then there
 *   is no way to look at an inline badge inside a *real* chapter — only inside the spike
 *   route — and "the badge does not disturb the line rhythm" is a claim that has to be
 *   checked by eye, in flowing text, at every reading size and in both themes.
 *
 *   This module seeds exactly one badge so that check is possible. It is off unless
 *   `EXPO_PUBLIC_READER_BADGE_PREVIEW=1`.
 *
 * Why it is deliberately trivial
 *   `flutter-port-map.md` risk #11 is that the prototype rotted around fixture data which
 *   outlived its purpose — a hardcoded Ruth 2 path that a naive port would have shipped.
 *   The defence is that this file cannot grow into a content source: it places one badge,
 *   on a word list six entries long, and the moment `useVerseBadges` queries the real
 *   endpoint it is deleted rather than extended.
 *
 * Dependencies
 *   The reader's badge-anchor type only. No React, no I/O — so the placement rule is
 *   tested rather than eyeballed.
 */

import type { VerseBadgeAnchor } from './verse-badges';

/** The minimum a verse must look like for the preview to consider it. */
export interface PreviewVerse {
  readonly verse: number;
  readonly text: string;
}

/**
 * Words the preview will annotate.
 *
 * Place names, because Route is the badge whose rendering is hardest to get right: it is
 * the widest pill, so it is the one most likely to disturb a line.
 */
export const PREVIEW_WORDS: readonly string[] = [
  'Jerusalem',
  'Philippi',
  'Troas',
  'Damascus',
  'Antioch',
  'Corinth',
];

/**
 * Places one Route badge in the first verse that carries a preview word.
 *
 * @param verses - The chapter's verses, in order.
 * @returns A map with at most one entry, keyed by verse number. Empty when the chapter
 *   mentions none of the words. Side effects: none.
 */
export function previewAnchors(
  verses: readonly PreviewVerse[],
): ReadonlyMap<number, readonly VerseBadgeAnchor[]> {
  for (const verse of verses) {
    const word = PREVIEW_WORDS.find((candidate) => verse.text.includes(candidate));
    if (word !== undefined) {
      return new Map([[verse.verse, [{ kind: 'route', word }]]]);
    }
  }
  return new Map();
}
