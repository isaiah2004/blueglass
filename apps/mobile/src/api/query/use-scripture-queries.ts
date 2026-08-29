/**
 * The reading canvas's four queries, as hooks.
 *
 * Purpose
 *   Bind `AtlasApi` to TanStack Query, per the port map's §4 recommendation to replace
 *   the prototype's hand-rolled `Loadable` loaders. What the Flutter `LampState` did
 *   with a status enum, a value field, an error field and a `catch (_) {}` per resource,
 *   a query does with one object — and does better, because it also dedupes, caches,
 *   and cancels.
 *
 * The behaviour from the prototype that is preserved on purpose
 *   **The reader never waits on enrichment** (`state.dart:139-194`, port map §4). Each
 *   of these is an independent query, so a chapter paints as soon as its own request
 *   lands, regardless of what else is in flight. That is a property of not combining
 *   them, so: never merge two of these into one hook.
 *
 * Cancellation
 *   Each `queryFn` forwards the `signal` TanStack supplies. Changing chapters aborts the
 *   previous chapter's request rather than letting it land and be discarded — the same
 *   discipline as the prototype's monotonic `_askToken` (port map §4), obtained here for
 *   free.
 *
 * Dependencies
 *   `@tanstack/react-query`, this folder, and `../endpoints`. No components, no styling.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { atlasApi } from '../atlas-client';
import type { ApiBook, ApiChapter, ApiSearchResults, ApiTranslation } from '../endpoints';
import type { AtlasApi, ChapterAddress, SearchQuery } from '../endpoints';
import { AtlasApiException, unwrapForQuery } from './api-exception';
import { IMMUTABLE_STALE_TIME_MS, SEARCH_STALE_TIME_MS } from './query-client';
import { atlasQueryKeys } from './query-keys';

/** Overrides every hook here accepts. */
export interface AtlasQueryOptions {
  /** The API to call. Defaults to the app's. Tests and Storybook pass a double. */
  readonly api?: AtlasApi | undefined;
  /** Run the query at all. Defaults to `true`, or to "the input is present". */
  readonly enabled?: boolean | undefined;
  /** Override the family's default staleness. */
  readonly staleTime?: number | undefined;
}

/** A query result carrying this layer's typed failure. */
export type AtlasQueryResult<TValue> = UseQueryResult<TValue, AtlasApiException>;

/**
 * The translations the switcher offers (`GET /translations`).
 *
 * Decision `S-01`: multiple open translations with a switcher. The list comes from the
 * server rather than from a constant precisely so that a translation which failed to
 * load cannot be offered — the switcher would open onto a blank chapter.
 */
export function useTranslationsQuery(
  options: AtlasQueryOptions = {},
): AtlasQueryResult<readonly ApiTranslation[]> {
  const api = options.api ?? atlasApi;
  return useQuery<readonly ApiTranslation[], AtlasApiException>({
    queryKey: atlasQueryKeys.translations(),
    queryFn: async ({ signal }) => unwrapForQuery(await api.getTranslations({ signal })),
    staleTime: options.staleTime ?? IMMUTABLE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  });
}

/**
 * The 66-book canon (`GET /books`).
 *
 * Served from the server's domain table, so it answers even against an empty database —
 * which means the reference picker can render before any scripture has loaded.
 */
export function useBooksQuery(
  options: AtlasQueryOptions = {},
): AtlasQueryResult<readonly ApiBook[]> {
  const api = options.api ?? atlasApi;
  return useQuery<readonly ApiBook[], AtlasApiException>({
    queryKey: atlasQueryKeys.books(),
    queryFn: async ({ signal }) => unwrapForQuery(await api.getBooks({ signal })),
    staleTime: options.staleTime ?? IMMUTABLE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  });
}

/**
 * One chapter (`GET /chapters/{translation}/{book}/{chapter}`).
 *
 * @param address - Which chapter, or `null` while the route has not resolved one. A
 *                  null address disables the query rather than fetching a placeholder,
 *                  so no request is made for a chapter nobody asked for.
 * @param options - Overrides.
 * @returns The query. Scripture is immutable, so a chapter already read is served from
 *          cache with no network call at all.
 */
export function useChapterQuery(
  address: ChapterAddress | null,
  options: AtlasQueryOptions = {},
): AtlasQueryResult<ApiChapter> {
  const api = options.api ?? atlasApi;
  const key =
    address === null
      ? atlasQueryKeys.chapters()
      : atlasQueryKeys.chapter(address.translation, address.book, address.chapter);

  return useQuery<ApiChapter, AtlasApiException>({
    queryKey: key,
    queryFn: async ({ signal }) => {
      // Unreachable while `enabled` is false; narrowing here keeps the type honest
      // without an assertion.
      if (address === null) throw new Error('A chapter query ran with no address.');
      return unwrapForQuery(await api.getChapter(address, { signal }));
    },
    staleTime: options.staleTime ?? IMMUTABLE_STALE_TIME_MS,
    enabled: (options.enabled ?? true) && address !== null,
  });
}

/**
 * Full-text scripture search (`GET /search`).
 *
 * @param query - What to search for, or `null` while the box is empty. A blank query is
 *                not sent: the server answers `422 query_too_short`, and spending a
 *                round trip to be told that is the search box's job to avoid.
 * @param options - Overrides.
 * @returns The query. Results are kept for a few minutes, which is what makes reopening
 *          the search popover show what was there — the behaviour the prototype had and
 *          the port map's §7 asks to preserve.
 */
export function useSearchQuery(
  query: SearchQuery | null,
  options: AtlasQueryOptions = {},
): AtlasQueryResult<ApiSearchResults> {
  const api = options.api ?? atlasApi;
  const hasQuery = query !== null && query.query.trim() !== '';
  const key = hasQuery
    ? atlasQueryKeys.search(query.query, query.translation ?? '', query.scope ?? 'all')
    : atlasQueryKeys.searches();

  return useQuery<ApiSearchResults, AtlasApiException>({
    queryKey: key,
    queryFn: async ({ signal }) => {
      if (query === null) throw new Error('A search query ran with no query.');
      return unwrapForQuery(await api.search(query, { signal }));
    },
    staleTime: options.staleTime ?? SEARCH_STALE_TIME_MS,
    enabled: (options.enabled ?? true) && hasQuery,
  });
}
