/**
 * Tests for the browser store and the platform seam it sits behind.
 *
 * What these prove
 *   - A value written survives a "reload" — a fresh store object over the same engine.
 *   - A browser that refuses storage degrades to memory instead of throwing.
 *   - A write that throws mid-session (quota) is swallowed, not surfaced.
 *   - The module the *web* bundle resolves never reports the native engine, which is
 *     the runtime half of the `react-native-mmkv` guard described in
 *     `mmkv-key-value-store.native.ts`.
 */

import { describe, expect, it } from 'vitest';

import { deviceKeyValueStore } from './device-storage';
import { createMemoryKeyValueStore } from './key-value-store';
import { createWebKeyValueStore, type WebStorageLike } from './web-key-value-store';

/** A `Storage` double whose data outlives the store objects built over it. */
function createFakeBrowserStorage(): WebStorageLike & { readonly entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

/** A `Storage` double that throws on every write, like a full or disabled origin. */
function createRefusingStorage(): WebStorageLike {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
}

describe('createWebKeyValueStore', () => {
  it('reports the local-storage engine when one is usable', () => {
    expect(createWebKeyValueStore(createFakeBrowserStorage()).kind).toBe('local-storage');
  });

  it('round-trips a value', async () => {
    const store = createWebKeyValueStore(createFakeBrowserStorage());

    await store.setString('atlas.test', 'psalm');

    await expect(store.getString('atlas.test')).resolves.toBe('psalm');
  });

  it('resolves undefined for an absent key rather than throwing', async () => {
    const store = createWebKeyValueStore(createFakeBrowserStorage());

    await expect(store.getString('never.written')).resolves.toBeUndefined();
  });

  it('keeps the value across a reload — a new store over the same engine', async () => {
    const browserStorage = createFakeBrowserStorage();
    await createWebKeyValueStore(browserStorage).setString('atlas.test', 'kept');

    const afterReload = createWebKeyValueStore(browserStorage);

    await expect(afterReload.getString('atlas.test')).resolves.toBe('kept');
  });

  it('removes a key', async () => {
    const browserStorage = createFakeBrowserStorage();
    const store = createWebKeyValueStore(browserStorage);
    await store.setString('atlas.test', 'gone');

    await store.remove('atlas.test');

    expect(browserStorage.entries.has('atlas.test')).toBe(false);
  });

  it('falls back to memory when the browser exposes no storage', async () => {
    const store = createWebKeyValueStore(null);

    expect(store.kind).toBe('memory');
    await store.setString('atlas.test', 'volatile');
    await expect(store.getString('atlas.test')).resolves.toBe('volatile');
  });

  it('swallows a write that throws, so a full quota is not an error the reader sees', async () => {
    const store = createWebKeyValueStore(createRefusingStorage());

    await expect(store.setString('atlas.test', 'dropped')).resolves.toBeUndefined();
    await expect(store.remove('atlas.test')).resolves.toBeUndefined();
  });
});

describe('createMemoryKeyValueStore', () => {
  it('does not share state between instances', async () => {
    const first = createMemoryKeyValueStore();
    const second = createMemoryKeyValueStore();

    await first.setString('atlas.test', 'first');

    await expect(second.getString('atlas.test')).resolves.toBeUndefined();
  });
});

describe('the platform seam', () => {
  it('never resolves to the native engine outside a native bundle', () => {
    // `device-storage.ts` is what Metro picks for `platform=web` and what Node picks
    // here. If someone points it at MMKV, the web build breaks — decision `T-01`.
    expect(deviceKeyValueStore.kind).not.toBe('mmkv');
  });

  it('loads its whole module graph under plain Node', () => {
    // Importing a native module would have thrown before this line ran: nitro modules
    // need the React Native runtime, which the test runner does not provide.
    expect(typeof deviceKeyValueStore.getString).toBe('function');
  });
});
