/**
 * Where a chapter's inline badges come from.
 *
 * Purpose
 *   The seam between the reading canvas and enrichment. M1 renders scripture; M2 delivers
 *   the badge records that annotate it. Declaring the boundary now — as a hook with a real
 *   return type the canvas already consumes — means M2 replaces one function body rather
 *   than threading a new prop through five components.
 *
 * Why enrichment is not bundled
 *   Decision `Q-007`: the database is never redistributed, which is what keeps the
 *   share-alike licences from triggering. Badge anchors are server-delivered, so this hook
 *   becomes a query against that endpoint. It is deliberately NOT a local dataset.
 *
 * The preview flag
 *   `EXPO_PUBLIC_READER_BADGE_PREVIEW=1` seeds one synthetic badge, so the inline-badge
 *   rendering path can be looked at inside a real chapter before any enrichment exists.
 *   Off by default; the placement rule lives in `model/badge-preview` and is tested there.
 *
 * Dependencies
 *   React, the reader's chapter type, and its badge model. No network yet.
 */

import { useMemo } from 'react';

import type { ApiChapter } from '@/api';
import { previewAnchors } from '../model/badge-preview';
import type { VerseBadgeAnchor } from '../model/verse-badges';

/** Badge anchors for one chapter, keyed by verse number. A missing key means none. */
export type VerseBadgeMap = ReadonlyMap<number, readonly VerseBadgeAnchor[]>;

/** A chapter with no enrichment. The M1 answer, shared so no caller allocates one. */
const NO_BADGES: VerseBadgeMap = new Map();

/**
 * Whether the development preview is on.
 *
 * Written as a static member access rather than an index, because that is the only form
 * Expo's bundler inlines: `process.env[name]` reads an empty object in the web bundle and
 * would silently never be true.
 *
 * @returns True only when the flag is explicitly `1`. Side effects: reads `process.env`,
 *   which Expo replaces at bundle time — so a build with the flag unset carries no preview
 *   branch at all.
 */
function previewEnabled(): boolean {
  return process.env.EXPO_PUBLIC_READER_BADGE_PREVIEW === '1';
}

/**
 * The badges to render inside one chapter's verses.
 *
 * @param chapter - The loaded chapter, or `undefined` while it is still loading.
 * @returns Anchors by verse number. Empty in M1 unless the preview flag is set.
 *   Side effects: none.
 */
export function useVerseBadges(chapter: ApiChapter | undefined): VerseBadgeMap {
  return useMemo(() => {
    if (chapter === undefined || !previewEnabled()) {
      return NO_BADGES;
    }
    return previewAnchors(chapter.verses);
  }, [chapter]);
}
