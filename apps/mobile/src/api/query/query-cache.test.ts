/**
 * Tests for the query cache and its persistence.
 *
 * What these prove
 *   1. **A repeat read is served from cache with no network call.** The whole of
 *      decision `O-01`'s in-session half, and the reason re-opening a chapter is
 *      instant.
 *   2. **A chapter read yesterday survives a relaunch.** The snapshot written by the
 *      persister hydrates a brand-new client, and the first read after that still makes
 *      no request.
 *   3. A snapshot from another schema version, or one older than the age limit, is
 *      discarded and deleted rather than served.
 *   4. Liveness and identity are never written to storage.
 */

import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { createHttpClient } from '../client';
import { createManualTimers, createRecordingFetch } from '../client/http-test-doubles';
import { createAtlasApi, type AtlasApi } from '../endpoints';
import { createMemoryKeyValueStore, QUERY_CACHE_STORAGE_KEY, type KeyValueStore } from '../storage';
import { unwrapForQuery } from './api-exception';
import { createAtlasQueryClient } from './query-client';
import { atlasQueryKeys } from './query-keys';
import { createQueryCachePersister, PERSISTED_CACHE_VERSION } from './query-persistence';

/** Verbatim `GET /chapters/BSB/John/3`, trimmed to one verse. */
const CHAPTER_BODY = {
  reference: 'John 3',
  translation: 'BSB',
  book_number: 43,
  chapter: 3,
  verses: [
    { verse: 16, text: 'For God so loved the world', osis_id: 'John.3.16', verse_key: 43_003_016 },
  ],
};

/** An API over a transport that answers with the chapter and counts every request. */
function chapterApi(): { api: AtlasApi; calls: { url: string }[] } {
  const { fetchImpl, calls } = createRecordingFetch([{ status: 200, body: CHAPTER_BODY }]);
  const client = createHttpClient({
    baseUrl: 'http://api.test',
    fetchImpl,
    policy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 },
  });
  return { api: createAtlasApi(client), calls };
}

/** Read John 3 through the cache, exactly as `useChapterQuery` does. */
async function readJohn3(queryClient: QueryClient, api: AtlasApi): Promise<string> {
  const chapter = await queryClient.fetchQuery({
    queryKey: atlasQueryKeys.chapter('BSB', 'John', 3),
    queryFn: async () =>
      unwrapForQuery(await api.getChapter({ translation: 'BSB', book: 'John', chapter: 3 })),
  });
  return chapter.reference;
}

describe('the query cache', () => {
  it('serves a repeat read without a network call', async () => {
    const queryClient = createAtlasQueryClient();
    const { api, calls } = chapterApi();

    await readJohn3(queryClient, api);
    const second = await readJohn3(queryClient, api);

    expect(second).toBe('John 3');
    expect(calls).toHaveLength(1);
  });

  it('treats a differently-cased address as the same chapter', async () => {
    const queryClient = createAtlasQueryClient();
    const { api, calls } = chapterApi();

    await queryClient.fetchQuery({
      queryKey: atlasQueryKeys.chapter('BSB', 'John', 3),
      queryFn: async () =>
        unwrapForQuery(await api.getChapter({ translation: 'BSB', book: 'John', chapter: 3 })),
    });
    await queryClient.fetchQuery({
      queryKey: atlasQueryKeys.chapter('bsb', 'john', 3),
      queryFn: async () =>
        unwrapForQuery(await api.getChapter({ translation: 'bsb', book: 'john', chapter: 3 })),
    });

    expect(calls).toHaveLength(1);
  });
});

describe('the persisted cache', () => {
  /** Read a chapter into a client, then snapshot it to `store`. */
  async function seedSnapshot(store: KeyValueStore): Promise<void> {
    const queryClient = createAtlasQueryClient();
    const { api } = chapterApi();
    await readJohn3(queryClient, api);

    const persister = createQueryCachePersister({
      queryClient,
      store,
      timers: createManualTimers(),
    });
    await persister.flush();
  }

  it('opens a chapter read in a previous session with no network call', async () => {
    const store = createMemoryKeyValueStore();
    await seedSnapshot(store);

    // A brand-new client is what a relaunch produces.
    const relaunched = createAtlasQueryClient();
    const persister = createQueryCachePersister({
      queryClient: relaunched,
      store,
      timers: createManualTimers(),
    });
    const restored = await persister.restore();

    const { api, calls } = chapterApi();
    const reference = await readJohn3(relaunched, api);

    expect(restored).toBe(true);
    expect(reference).toBe('John 3');
    expect(calls).toHaveLength(0);
  });

  it('reports nothing to restore when storage is empty', async () => {
    const persister = createQueryCachePersister({
      queryClient: createAtlasQueryClient(),
      store: createMemoryKeyValueStore(),
      timers: createManualTimers(),
    });

    await expect(persister.restore()).resolves.toBe(false);
  });

  it('discards and deletes a snapshot from another schema version', async () => {
    const store = createMemoryKeyValueStore();
    await store.setString(
      QUERY_CACHE_STORAGE_KEY,
      JSON.stringify({ version: PERSISTED_CACHE_VERSION + 1, savedAt: Date.now(), state: {} }),
    );
    const persister = createQueryCachePersister({
      queryClient: createAtlasQueryClient(),
      store,
      timers: createManualTimers(),
    });

    await expect(persister.restore()).resolves.toBe(false);
    await expect(store.getString(QUERY_CACHE_STORAGE_KEY)).resolves.toBeUndefined();
  });

  it('discards a snapshot older than the age limit', async () => {
    const store = createMemoryKeyValueStore();
    await seedSnapshot(store);

    const persister = createQueryCachePersister({
      queryClient: createAtlasQueryClient(),
      store,
      timers: createManualTimers(),
      maxAgeMs: 1_000,
      now: () => Date.now() + 60_000,
    });

    await expect(persister.restore()).resolves.toBe(false);
  });

  it('discards unparseable bytes instead of failing startup', async () => {
    const store = createMemoryKeyValueStore();
    await store.setString(QUERY_CACHE_STORAGE_KEY, '{"version":1,"savedAt":');
    const persister = createQueryCachePersister({
      queryClient: createAtlasQueryClient(),
      store,
      timers: createManualTimers(),
    });

    await expect(persister.restore()).resolves.toBe(false);
  });

  it('never writes liveness or identity to storage', async () => {
    const store = createMemoryKeyValueStore();
    const queryClient = createAtlasQueryClient();
    queryClient.setQueryData(atlasQueryKeys.health(), { status: 'ok' });
    queryClient.setQueryData(atlasQueryKeys.identity(), { subject: 'device:atlas-abc' });
    queryClient.setQueryData(atlasQueryKeys.books(), []);

    await createQueryCachePersister({
      queryClient,
      store,
      timers: createManualTimers(),
    }).flush();

    const written = (await store.getString(QUERY_CACHE_STORAGE_KEY)) ?? '';
    expect(written).toContain('books');
    expect(written).not.toContain('health');
    expect(written).not.toContain('identity');
  });

  it('throttles writes: many cache changes cause one scheduled write', () => {
    const timers = createManualTimers();
    const queryClient = new QueryClient();
    const persister = createQueryCachePersister({
      queryClient,
      store: createMemoryKeyValueStore(),
      timers,
    });

    const stop = persister.start();
    queryClient.setQueryData(atlasQueryKeys.books(), [1]);
    queryClient.setQueryData(atlasQueryKeys.books(), [1, 2]);
    queryClient.setQueryData(atlasQueryKeys.translations(), []);

    expect(timers.pendingCount()).toBe(1);
    stop();
    expect(timers.pendingCount()).toBe(0);
  });
});
