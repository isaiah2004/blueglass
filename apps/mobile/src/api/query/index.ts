/**
 * Server state: the query cache, its keys, its hooks, and its persistence.
 *
 * Purpose
 *   The public surface of `src/api/query`. Everything the app needs to read from the
 *   API without writing a loading flag, an error field, or a `useEffect` by hand.
 *
 * The division of labour this folder assumes
 *   ```
 *   server-owned data  -> here (TanStack Query: cached, deduped, cancellable)
 *   client-owned state -> src/stores  (Zustand)
 *   streaming drafts   -> src/api/stream/chat-draft-store  (isolated; see risk #2)
 *   ```
 *   That split is the port map's §4 recommendation, and it is the reason a chapter's
 *   text is not in a Zustand store: it is not the client's to own.
 *
 * Wiring it up (once, in the app shell)
 *   ```tsx
 *   const queryClient = useMemo(createAtlasQueryClient, []);
 *   useEffect(() => {
 *     const persister = createQueryCachePersister({ queryClient });
 *     void persister.restore();
 *     return persister.start();
 *   }, [queryClient]);
 *   return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
 *   ```
 *
 * Usage
 *   ```ts
 *   const chapter = useChapterQuery({ translation: 'BSB', book: 'John', chapter: 3 });
 *   ```
 */

export { AtlasApiException, toApiError, unwrapForQuery } from './api-exception';

export {
  createAtlasQueryClient,
  DEFAULT_GC_TIME_MS,
  DEFAULT_STALE_TIME_MS,
  HEALTH_STALE_TIME_MS,
  IMMUTABLE_STALE_TIME_MS,
  SEARCH_STALE_TIME_MS,
} from './query-client';

export { atlasQueryKeys, type AtlasQueryKey } from './query-keys';

export {
  createQueryCachePersister,
  DEFAULT_PERSIST_MAX_AGE_MS,
  DEFAULT_PERSIST_THROTTLE_MS,
  PERSISTED_CACHE_VERSION,
  type QueryCachePersister,
  type QueryCachePersisterOptions,
} from './query-persistence';

export {
  useBooksQuery,
  useChapterQuery,
  useSearchQuery,
  useTranslationsQuery,
  type AtlasQueryOptions,
  type AtlasQueryResult,
} from './use-scripture-queries';

export { useHealthQuery, useIdentityQuery } from './use-service-queries';
