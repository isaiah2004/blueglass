/**
 * Which badge the reader has open.
 *
 * Purpose
 *   One badge is open at a time, on every form factor, and the open one must not survive a
 *   change of chapter. Both are easy to get wrong with a bare `useState`: turning the page
 *   while a sheet is open would otherwise leave Acts 16's Route sheet floating over Acts 17.
 *
 * Why there is no effect here
 *   The chapter is part of the stored value, not a dependency that resets it. A selection
 *   whose chapter is not the current one is simply not open — so the reset happens in the
 *   same render as the navigation, with no intermediate frame in which the wrong sheet is on
 *   screen and no effect to forget to write.
 *
 * Dependencies
 *   React and this folder's models. No navigation, no queries.
 */

import { useCallback, useMemo, useState } from 'react';

import type { ReaderBadge } from './badge-models';

/** What the reader screen drives the badge surfaces with. */
export interface BadgeSelection {
  /** The open badge, or `undefined` when none is. */
  readonly badge: ReaderBadge | undefined;
  /**
   * Open a badge by id. An id absent from this chapter opens nothing.
   *
   * @param badgeId - The badge's stable id.
   */
  readonly open: (badgeId: string) => void;
  /** Close whatever is open. */
  readonly close: () => void;
}

/** The stored value: which badge, and which chapter it belonged to. */
interface OpenBadge {
  readonly chapterKey: string;
  readonly badgeId: string;
}

/**
 * Track the open badge for one chapter.
 *
 * @param chapterKey - A value that changes whenever the reader moves to another chapter or
 *   another translation. Anything stable and unique will do; the reader passes the address.
 * @param byId - The chapter's badges, indexed by id.
 * @returns The open badge and the two commands. Side effects: none.
 */
export function useBadgeSelection(
  chapterKey: string,
  byId: ReadonlyMap<string, ReaderBadge>,
): BadgeSelection {
  const [openBadge, setOpenBadge] = useState<OpenBadge | null>(null);

  const open = useCallback(
    (badgeId: string) => {
      setOpenBadge({ chapterKey, badgeId });
    },
    [chapterKey],
  );

  const close = useCallback(() => {
    setOpenBadge(null);
  }, []);

  const badge = useMemo(() => {
    if (openBadge === null || openBadge.chapterKey !== chapterKey) {
      return undefined;
    }
    return byId.get(openBadge.badgeId);
  }, [openBadge, chapterKey, byId]);

  return { badge, open, close };
}
