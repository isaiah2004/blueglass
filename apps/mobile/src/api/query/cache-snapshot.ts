/**
 * The persisted cache's file format, and the two operations on it.
 *
 * Purpose
 *   Everything about *what* is written to storage and how it is read back, separated
 *   from `query-persistence.ts`, which decides *when*. The split keeps both under the
 *   50-line function limit and, more usefully, means the format can be reasoned about
 *   without also reasoning about throttling.
 *
 * The wrapper, and why the snapshot is not stored bare
 *   ```jsonc
 *   { "version": 1, "savedAt": 1756400000000, "state": { …dehydrated… } }
 *   ```
 *   `version` lets a shape change ship as a discard rather than as a migration.
 *   `savedAt` lets a snapshot expire. A bare `DehydratedState` would support neither,
 *   and a cache that cannot be expired is a cache that will one day serve a chapter
 *   from a translation the reader has since removed.
 *
 * Which queries are written
 *   Successful ones, minus liveness and identity. A stored liveness answer is worthless
 *   the moment it is written; a stored identity is one request from being re-derived
 *   while carrying the device id into a second storage key.
 *
 * Dependencies
 *   `@tanstack/react-query` and the storage contract.
 */

import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';

import type { KeyValueStore, StorageKey } from '../storage';

/** Bump when the dehydrated shape changes. An older snapshot is then discarded. */
export const PERSISTED_CACHE_VERSION = 1;

/** What is stored, wrapped so the version and the age travel with the data. */
interface CacheEnvelope {
  readonly version: number;
  readonly savedAt: number;
  readonly state: DehydratedState;
}

/**
 * Should this query be written to disk?
 *
 * @param queryKey - The key, whose second segment is the family name.
 * @returns Whether it belongs in a snapshot. Side effects: none.
 */
export function isPersistableQuery(queryKey: readonly unknown[]): boolean {
  const family = queryKey[1];
  return family !== 'health' && family !== 'identity';
}

/** Read the envelope out of stored text, rejecting anything unexpected. */
function parseEnvelope(text: string): CacheEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    // Truncated by a killed process, or written by something else on this origin.
    void cause;
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<CacheEnvelope>;
  if (candidate.version !== PERSISTED_CACHE_VERSION) return null;
  if (typeof candidate.savedAt !== 'number' || candidate.state === undefined) return null;
  return { version: candidate.version, savedAt: candidate.savedAt, state: candidate.state };
}

/**
 * Serialise the cache and store it.
 *
 * @param queryClient - The cache to snapshot.
 * @param store - Where to put it.
 * @param storageKey - Under which key.
 * @param savedAt - The timestamp to stamp on it.
 * @returns Nothing. Side effects: one dehydration and one write.
 */
export async function writeSnapshot(
  queryClient: QueryClient,
  store: KeyValueStore,
  storageKey: StorageKey,
  savedAt: number,
): Promise<void> {
  const state = dehydrate(queryClient, {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && isPersistableQuery(query.queryKey),
  });
  const envelope: CacheEnvelope = { version: PERSISTED_CACHE_VERSION, savedAt, state };
  await store.setString(storageKey, JSON.stringify(envelope));
}

/**
 * Read a snapshot back into a cache, discarding one that cannot be trusted.
 *
 * Three ways a stored snapshot is refused, and all three delete it: a version this build
 * does not read, an age past the limit, and bytes that fail to hydrate. Deleting is the
 * point — keeping it would cost the same failed read on every launch from now on.
 *
 * @param queryClient - The cache to fill.
 * @param store - Where to read from.
 * @param storageKey - Which key.
 * @param maxAgeMs - How old a snapshot may be.
 * @param now - The current time, injectable so a test can age a snapshot.
 * @returns Whether anything was hydrated. Side effects: one read, and possibly one
 *          delete and one hydration.
 */
export async function readSnapshot(
  queryClient: QueryClient,
  store: KeyValueStore,
  storageKey: StorageKey,
  maxAgeMs: number,
  now: () => number,
): Promise<boolean> {
  const stored = await store.getString(storageKey);
  if (stored === undefined) return false;

  const envelope = parseEnvelope(stored);
  if (envelope === null || now() - envelope.savedAt > maxAgeMs) {
    await store.remove(storageKey);
    return false;
  }

  try {
    hydrate(queryClient, envelope.state);
    return true;
  } catch (cause) {
    void cause;
    await store.remove(storageKey);
    return false;
  }
}
