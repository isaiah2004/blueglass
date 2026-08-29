/**
 * The identity seam: one device id, minted once, persisted, sent on every request.
 *
 * Purpose
 *   Decision `A-01`. The port map's risk #9 is that the prototype had *no* seam — every
 *   `/me/*` route resolved to the literal string `dev-user`, so every device on earth
 *   shared one account. This module is the client half of not repeating that, and the
 *   server's `DeviceIdentityResolver` is the other half.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  THIS IS THE ONLY PLACE THAT DECIDES WHO A REQUEST IS.
 *  Adding real accounts means writing another {@link HeaderProvider} and passing it to
 *  `createHttpClient`. No endpoint, hook, or store changes.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The three properties this must have, and how each is obtained
 *   1. **Stable across launches.** Read from a {@link KeyValueStore} before minting.
 *   2. **Minted exactly once, even under concurrency.** Startup fires four requests at
 *      the same time; each asks for headers. The in-flight promise is memoised, so all
 *      four await one resolution and no reader ends up with two identities and half
 *      their data under each.
 *   3. **Valid by the server's rules.** A stored value that fails
 *      {@link isValidDeviceId} — corrupted, or written by an older build — is replaced
 *      rather than sent, because sending it produces a 401 the reader cannot act on.
 *
 * What happens when storage does not persist
 *   A private-mode browser gives a memory store. The id is then minted per session and
 *   the reader's data does not follow them, which is a real degradation but not a
 *   failure: the app still works, and every request still carries an identity. The
 *   caller can see it coming from `store.kind` before it happens.
 *
 * Dependencies
 *   `device-id.ts` and the storage contract. No HTTP, no React.
 */

import { DEVICE_ID_STORAGE_KEY, deviceKeyValueStore, type KeyValueStore } from '../storage';
import {
  DEVICE_ID_HEADER,
  generateDeviceId,
  isValidDeviceId,
  type DeviceIdQuality,
} from './device-id';

/** What resolving the identity produced. */
export interface ResolvedDeviceIdentity {
  readonly deviceId: string;
  /** True when this launch minted the id rather than reading it. */
  readonly isFreshlyMinted: boolean;
  /** Entropy quality of a freshly minted id; `strong` for one read from storage. */
  readonly quality: DeviceIdQuality;
}

/** The client-facing identity. */
export interface DeviceIdentity {
  /** Resolve the id, minting and persisting one on first use. Memoised. */
  resolve(): Promise<ResolvedDeviceIdentity>;
  /** The headers to merge into a request. Shape matches `HeaderProvider`. */
  headers(): Promise<Readonly<Record<string, string>>>;
  /**
   * Forget the memoised id and remove it from storage.
   *
   * For "sign out of this device" and for tests. Deliberately not called anywhere in
   * the app today: dropping the id orphans every row the server scoped to it.
   */
  forget(): Promise<void>;
}

/** Construction options. */
export interface DeviceIdentityOptions {
  /** Where to persist. Defaults to the platform store. */
  readonly store?: KeyValueStore;
  /** Storage key. Defaults to {@link DEVICE_ID_STORAGE_KEY}. */
  readonly storageKey?: string;
  /** Mints a new id. Injected so a test can assert how many times it ran. */
  readonly mint?: () => { deviceId: string; quality: DeviceIdQuality };
}

/**
 * Read a usable id from storage.
 *
 * @param store - Where to look.
 * @param key - The storage key.
 * @returns The stored id, or `null` when absent, empty, or no longer valid.
 *          Side effects: one read.
 */
async function readStoredDeviceId(store: KeyValueStore, key: string): Promise<string | null> {
  const stored = await store.getString(key);
  if (stored === undefined) return null;
  return isValidDeviceId(stored) ? stored : null;
}

/**
 * Build the identity.
 *
 * @param options - Overrides. All default to the shipping configuration.
 * @returns The identity. Create one per app: two would each memoise their own promise
 *          and could mint two ids on a first launch.
 */
export function createDeviceIdentity(options: DeviceIdentityOptions = {}): DeviceIdentity {
  const store = options.store ?? deviceKeyValueStore;
  const storageKey = options.storageKey ?? DEVICE_ID_STORAGE_KEY;
  const mint = options.mint ?? (() => generateDeviceId());

  // The memoised *promise*, not the value: memoising the value would still let a second
  // caller start a second mint while the first is between its read and its write.
  let pending: Promise<ResolvedDeviceIdentity> | null = null;

  async function load(): Promise<ResolvedDeviceIdentity> {
    const stored = await readStoredDeviceId(store, storageKey);
    if (stored !== null) {
      return { deviceId: stored, isFreshlyMinted: false, quality: 'strong' };
    }

    const minted = mint();
    await store.setString(storageKey, minted.deviceId);
    return { deviceId: minted.deviceId, isFreshlyMinted: true, quality: minted.quality };
  }

  function resolve(): Promise<ResolvedDeviceIdentity> {
    pending ??= load();
    return pending;
  }

  return {
    resolve,

    async headers(): Promise<Readonly<Record<string, string>>> {
      const identity = await resolve();
      return { [DEVICE_ID_HEADER]: identity.deviceId };
    },

    async forget(): Promise<void> {
      pending = null;
      await store.remove(storageKey);
    },
  };
}

/** The app's identity. One per process, for the reason given on the factory. */
export const deviceIdentity: DeviceIdentity = createDeviceIdentity();

/**
 * The app's {@link HeaderProvider}.
 *
 * Pass this to `createHttpClient`. It is a bound method rather than the object so that
 * the client depends on the *function type*, not on this module — which is what makes
 * the account swap a one-line change at the composition root.
 */
export const deviceIdentityHeaders = (): Promise<Readonly<Record<string, string>>> =>
  deviceIdentity.headers();
