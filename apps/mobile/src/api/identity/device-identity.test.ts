/**
 * Tests for the identity seam.
 *
 * What these prove
 *   1. **The device id persists across reloads.** A second identity built over the same
 *      store returns the same id — which is what makes a reader's highlights still
 *      theirs tomorrow.
 *   2. It is minted exactly once, even when four startup requests ask at the same
 *      instant. Two ids would split one reader's data across two server-side subjects.
 *   3. A stored value the server would reject is replaced rather than sent, so a
 *      corrupted id costs one mint instead of a 401 the reader cannot act on.
 *   4. The header the client sends is the header the server reads.
 */

import { describe, expect, it, vi } from 'vitest';

import { createMemoryKeyValueStore, type KeyValueStore } from '../storage';
import { DEVICE_ID_HEADER, generateDeviceId, isValidDeviceId } from './device-id';
import { createDeviceIdentity } from './device-identity';

/** A store whose data outlives the identity objects built over it — i.e. a "reload". */
function persistentStore(): KeyValueStore {
  return createMemoryKeyValueStore();
}

describe('createDeviceIdentity', () => {
  it('mints an id the server would accept', async () => {
    const identity = createDeviceIdentity({ store: persistentStore() });

    const resolved = await identity.resolve();

    expect(resolved.isFreshlyMinted).toBe(true);
    expect(isValidDeviceId(resolved.deviceId)).toBe(true);
  });

  it('keeps the same id across a reload', async () => {
    const store = persistentStore();
    const first = await createDeviceIdentity({ store }).resolve();

    // A new identity over the same storage is exactly what a relaunch produces.
    const second = await createDeviceIdentity({ store }).resolve();

    expect(second.deviceId).toBe(first.deviceId);
    expect(second.isFreshlyMinted).toBe(false);
  });

  it('mints once, not four times, when startup asks concurrently', async () => {
    const mint = vi.fn(() => generateDeviceId());
    const identity = createDeviceIdentity({ store: persistentStore(), mint });

    const resolutions = await Promise.all([
      identity.resolve(),
      identity.resolve(),
      identity.resolve(),
      identity.resolve(),
    ]);

    expect(mint).toHaveBeenCalledTimes(1);
    expect(new Set(resolutions.map((one) => one.deviceId)).size).toBe(1);
  });

  it('replaces a stored id the server would reject', async () => {
    const store = persistentStore();
    await store.setString('atlas.identity.device-id.v1', 'no');

    const resolved = await createDeviceIdentity({ store }).resolve();

    expect(resolved.isFreshlyMinted).toBe(true);
    expect(isValidDeviceId(resolved.deviceId)).toBe(true);
  });

  it('writes the id under the storage key it reads from', async () => {
    const store = persistentStore();
    const identity = createDeviceIdentity({ store, storageKey: 'custom.key' });

    const resolved = await identity.resolve();

    await expect(store.getString('custom.key')).resolves.toBe(resolved.deviceId);
  });

  it('sends the header the server reads', async () => {
    const identity = createDeviceIdentity({ store: persistentStore() });

    const headers = await identity.headers();

    // Mirrors DEVICE_ID_HEADER in apps/api/.../device_identity_resolver.py.
    expect(DEVICE_ID_HEADER).toBe('X-Atlas-Device-Id');
    expect(Object.keys(headers)).toEqual([DEVICE_ID_HEADER]);
    expect(isValidDeviceId(headers[DEVICE_ID_HEADER] ?? '')).toBe(true);
  });

  it('forgets the id on request, and mints a different one afterwards', async () => {
    const store = persistentStore();
    const identity = createDeviceIdentity({ store });
    const before = await identity.resolve();

    await identity.forget();
    const after = await identity.resolve();

    expect(after.deviceId).not.toBe(before.deviceId);
  });

  it('degrades to a per-session id when storage does not persist', async () => {
    // A private-mode browser hands back a memory store; each launch is a fresh one.
    const firstSession = await createDeviceIdentity({ store: persistentStore() }).resolve();
    const secondSession = await createDeviceIdentity({ store: persistentStore() }).resolve();

    expect(firstSession.deviceId).not.toBe(secondSession.deviceId);
    expect(isValidDeviceId(secondSession.deviceId)).toBe(true);
  });
});
