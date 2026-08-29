/**
 * The seam between the reading canvas and enrichment.
 *
 * Purpose
 *   M1 declared this boundary with a stub so that M2 would replace one function body rather
 *   than thread a new prop through five components. This is that replacement: the hook now
 *   runs the real query and hands the canvas the three shapes it needs — the anchors indexed
 *   by verse, the badges in the server's order for the chapter-end summary, and a lookup by
 *   id so a tapped pill can find its own record.
 *
 * Why enrichment is not bundled
 *   Decision `Q-007`: the database is never redistributed, which is what keeps the
 *   share-alike licences from triggering. Badges are server-delivered, always.
 *
 * The reader never waits on enrichment
 *   This is a second query, deliberately not merged with the chapter read. Scripture paints
 *   as soon as its own request lands; pills appear when theirs does. A chapter that is still
 *   fetching badges, or whose badge request failed, is a chapter with no pills — never a
 *   chapter with no text.
 *
 * Dependencies
 *   React, `../badges`, and the reader's badge models. No components.
 */

import { useMemo } from 'react';

import {
  anchorsByVerseKey,
  badgesById,
  NO_BADGE_SOURCES,
  NO_CHAPTER_BADGES,
  NO_VERSE_BADGES,
  useChapterBadgesQuery,
  type BadgeChapterAddress,
  type SourceAttribution,
  type ChapterBadgesOptions,
  type ReaderBadge,
  type VerseBadgeMap,
} from '../badges';

export type { VerseBadgeMap } from '../badges';

/** Everything the canvas needs to draw a chapter's badges. */
export interface ChapterBadgeView {
  /** Anchors by packed `verseKey`, capped per verse. */
  readonly anchors: VerseBadgeMap;
  /** Every badge the chapter delivered, in the server's order — the summary list's source. */
  readonly badges: readonly ReaderBadge[];
  /** Badge id to badge, for opening a sheet from a tapped pill. */
  readonly byId: ReadonlyMap<string, ReaderBadge>;
  /**
   * The union of every source the chapter's badges rest on.
   *
   * `AI-05`: the summary list prints these once beneath it, so the teasers above are as
   * attributed as the sheets they open.
   */
  readonly sources: readonly SourceAttribution[];
  /** True while the first request for this chapter is in flight. */
  readonly isPending: boolean;
  /**
   * True when the badge request failed.
   *
   * Surfaced rather than swallowed, but the canvas still renders the chapter: enrichment is
   * additive, and a failed badge read must never look like a failed chapter read.
   */
  readonly isError: boolean;
}

/** The answer for a chapter with no enrichment, shared for the same reason. */
const EMPTY_VIEW: ChapterBadgeView = {
  anchors: NO_VERSE_BADGES,
  badges: NO_CHAPTER_BADGES,
  byId: new Map(),
  sources: NO_BADGE_SOURCES,
  isPending: false,
  isError: false,
};

/**
 * The badges to render inside one chapter.
 *
 * @param address - Which chapter's badges, or `null` before the route resolves one.
 * @param options - Overrides. Tests pass an API double.
 * @returns The three shapes plus the two status flags. Side effects: one HTTP GET, deduped
 *   and cached by TanStack Query.
 */
export function useVerseBadges(
  address: BadgeChapterAddress | null,
  options: ChapterBadgesOptions = {},
): ChapterBadgeView {
  const query = useChapterBadgesQuery(address, options);
  const badges = query.data?.badges;
  const sources = query.data?.sources;

  return useMemo(() => {
    if (badges === undefined || badges.length === 0) {
      return { ...EMPTY_VIEW, isPending: query.isPending, isError: query.isError };
    }
    return {
      anchors: anchorsByVerseKey(badges),
      badges,
      byId: badgesById(badges),
      sources: sources ?? NO_BADGE_SOURCES,
      isPending: false,
      isError: false,
    };
  }, [badges, sources, query.isPending, query.isError]);
}
