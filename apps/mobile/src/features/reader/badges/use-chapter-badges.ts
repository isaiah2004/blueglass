/**
 * Where a chapter's inline badges come from.
 *
 * Purpose
 *   One query per chapter, run *beside* the chapter text rather than after it. That
 *   separation is the behaviour the port map's §4 singles out and the reason these are not
 *   one hook: **the reader never waits on enrichment.** Scripture paints the instant its own
 *   request lands; the pills arrive when they arrive.
 *
 * Why enrichment is not bundled
 *   Decision `Q-007`: the database is never redistributed, which is what keeps the
 *   share-alike licences from triggering. Badges are server-delivered, always.
 *
 * Cancellation and cache
 *   The `signal` is forwarded, so turning the page aborts the previous chapter's badge
 *   request instead of letting it land under the wrong text. Enrichment for a given
 *   translation and chapter is immutable between deployments, so it takes the immutable
 *   stale time — a chapter read twice costs one request.
 *
 * Dependencies
 *   `@tanstack/react-query`, `@/api`, and this folder's API and models.
 */

import { useQuery } from '@tanstack/react-query';

import {
  atlasQueryKeys,
  AtlasApiException,
  IMMUTABLE_STALE_TIME_MS,
  unwrapForQuery,
  type AtlasQueryResult,
} from '@/api';

import { badgeApi, type BadgeApi, type BadgeChapterAddress } from './badge-api';
import type { ChapterBadges } from './badge-models';

/** Overrides the hook accepts. Tests pass a double rather than a server. */
export interface ChapterBadgesOptions {
  /** The API to call. Defaults to the app's. */
  readonly api?: BadgeApi | undefined;
  /** Run the query at all. Defaults to "there is an address". */
  readonly enabled?: boolean | undefined;
}

/**
 * One chapter's badges.
 *
 * @param address - Which chapter, or `null` while the route has not resolved one.
 * @param options - Overrides.
 * @returns The query. A chapter with no enrichment resolves successfully with an empty
 *   `badges` list — that is the honest answer for most of the canon, and treating it as an
 *   error would make an unenriched chapter look broken. Side effects: one HTTP GET.
 */
export function useChapterBadgesQuery(
  address: BadgeChapterAddress | null,
  options: ChapterBadgesOptions = {},
): AtlasQueryResult<ChapterBadges> {
  const api = options.api ?? badgeApi;
  const key =
    address === null
      ? atlasQueryKeys.chapterBadgesAll()
      : atlasQueryKeys.chapterBadges(address.translation, address.book, address.chapter);

  return useQuery<ChapterBadges, AtlasApiException>({
    queryKey: key,
    queryFn: async ({ signal }) => {
      // Unreachable while `enabled` is false; narrowing here keeps the type honest.
      if (address === null) throw new Error('A badge query ran with no address.');
      return unwrapForQuery(await api.getChapterBadges(address, { signal }));
    },
    staleTime: IMMUTABLE_STALE_TIME_MS,
    enabled: (options.enabled ?? true) && address !== null,
  });
}
