/**
 * Tests for the persisted preferences store and its storage adapter.
 *
 * What these prove
 *   - A preference chosen in one launch is read back in the next, through the same code
 *     path the app uses — `createPrefsStore` over a store whose data survives.
 *   - Only data is persisted. The actions are recreated by the factory each launch, and
 *     writing them would overwrite live functions with `{}` on rehydration.
 *   - The engine is reached only through `KeyValueStore`, so nothing here can drag a
 *     native module into the web bundle (decision `T-01`).
 */

import { describe, expect, it } from 'vitest';

import { createMemoryKeyValueStore, PREFERENCES_STORAGE_KEY } from '@/api/storage';

import { createPrefsStore, DEFAULT_PREFS } from './prefs.store';
import { toStateStorage } from './state-storage';

describe('toStateStorage', () => {
  it('reports an absent key as null, the way Zustand expects', async () => {
    const storage = toStateStorage(createMemoryKeyValueStore());

    await expect(storage.getItem('never.written')).resolves.toBeNull();
  });

  it('round-trips a value and removes it', async () => {
    const storage = toStateStorage(createMemoryKeyValueStore());

    await storage.setItem('atlas.test', '{"a":1}');
    await expect(storage.getItem('atlas.test')).resolves.toBe('{"a":1}');

    await storage.removeItem('atlas.test');
    await expect(storage.getItem('atlas.test')).resolves.toBeNull();
  });
});

describe('the preferences store', () => {
  it('starts on the shipping defaults', () => {
    const prefs = createPrefsStore(createMemoryKeyValueStore());

    expect(prefs.getState()).toMatchObject(DEFAULT_PREFS);
  });

  it('opens on BSB, never on a licensed translation', () => {
    // ESV appears in the mockups, is licensed by Crossway, and must never ship.
    expect(DEFAULT_PREFS.translationCode).toBe('BSB');
  });

  it('keeps a chosen preference across a relaunch', async () => {
    const store = createMemoryKeyValueStore();
    const firstLaunch = createPrefsStore(store);
    await firstLaunch.persist.rehydrate();

    firstLaunch.getState().setTranslationCode('WEB');
    firstLaunch.getState().setScriptureSize('large');
    firstLaunch.getState().setWebSearch(true);

    // A second store over the same engine is what a relaunch produces.
    const secondLaunch = createPrefsStore(store);
    await secondLaunch.persist.rehydrate();

    expect(secondLaunch.getState()).toMatchObject({
      translationCode: 'WEB',
      scriptureSize: 'large',
      webSearch: true,
      useRag: DEFAULT_PREFS.useRag,
    });
  });

  it('persists only data, never the actions', async () => {
    const store = createMemoryKeyValueStore();
    const prefs = createPrefsStore(store);
    await prefs.persist.rehydrate();

    prefs.getState().setUseRag(false);

    const written = (await store.getString(PREFERENCES_STORAGE_KEY)) ?? '';
    expect(written).toContain('"useRag":false');
    expect(written).not.toContain('setUseRag');
  });

  it('restores every default on reset, and the reset survives a relaunch', async () => {
    const store = createMemoryKeyValueStore();
    const prefs = createPrefsStore(store);
    await prefs.persist.rehydrate();
    prefs.getState().setTranslationCode('ASV');

    prefs.getState().reset();

    const relaunched = createPrefsStore(store);
    await relaunched.persist.rehydrate();
    expect(relaunched.getState()).toMatchObject(DEFAULT_PREFS);
  });

  it('falls back to the defaults when the stored value is unreadable', async () => {
    const store = createMemoryKeyValueStore();
    await store.setString(PREFERENCES_STORAGE_KEY, 'not json');

    const prefs = createPrefsStore(store);
    await prefs.persist.rehydrate();

    expect(prefs.getState()).toMatchObject(DEFAULT_PREFS);
  });
});
