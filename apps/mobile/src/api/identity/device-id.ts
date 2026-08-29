/**
 * Minting and validating the anonymous device id.
 *
 * Purpose
 *   Decision `A-01` is "anonymous device id now, real accounts later". This module owns
 *   the value itself: what it looks like, how it is generated, and what the server will
 *   accept. It knows nothing about storage or about HTTP, which is what lets its rules
 *   be tested without either.
 *
 * The contract with the server
 *   `apps/api/app/modules/identity/domain/identity.py` validates every id against
 *   `^[A-Za-z0-9._:-]{8,128}$` and rejects anything else with `invalid_device_id` —
 *   the same 401 as sending no header at all. {@link isValidDeviceId} is that regular
 *   expression, mirrored, so a malformed id is caught here rather than as a mysterious
 *   401 on the first read of a cold start.
 *
 * Entropy, honestly
 *   A device id is not a secret in the cryptographic sense — the server's own note says
 *   it is "an assertion, not proof" — but it does separate one reader's data from
 *   another's, so a *guessable* id is a privacy defect. Three sources are tried in
 *   order, best first:
 *
 *     1. `crypto.randomUUID()`      — browsers, and Hermes builds that expose WebCrypto.
 *     2. `crypto.getRandomValues()` — the same guarantee, assembled by hand.
 *     3. `Math.random()`            — **not cryptographically strong.**
 *
 *   The third is reachable on a bare Hermes runtime with no WebCrypto polyfill. It is
 *   kept because the alternative is a client that cannot identify itself at all, and it
 *   is reported through {@link DeviceIdQuality} rather than hidden, so startup can
 *   decide what to do about it. Queued as `ID-01`; recorded in
 *   `docs/decisions/ASSUMPTIONS.md`.
 *
 * Dependencies
 *   None.
 */

/** How much to trust the randomness behind a generated id. */
export type DeviceIdQuality = 'strong' | 'weak';

/** A freshly minted id and the quality of the entropy it came from. */
export interface GeneratedDeviceId {
  readonly deviceId: string;
  readonly quality: DeviceIdQuality;
}

/** The header the server reads. Matches `DEVICE_ID_HEADER` in the identity resolver. */
export const DEVICE_ID_HEADER = 'X-Atlas-Device-Id';

/** Mirror of the server's validator. Anything else earns a 401, not a 400. */
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/** Hex characters in a generated id: 128 bits, the same width as a UUID. */
const DEVICE_ID_HEX_LENGTH = 32;

/**
 * Would the server accept this id?
 *
 * @param candidate - The id to check, typically one just read from storage.
 * @returns Whether it matches the server's pattern. Side effects: none.
 */
export function isValidDeviceId(candidate: string): boolean {
  return DEVICE_ID_PATTERN.test(candidate);
}

/** The WebCrypto surface this module uses, if the runtime happens to have it. */
interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: <TArray extends Uint8Array>(array: TArray) => TArray;
}

/**
 * Read WebCrypto off the global object without assuming it is there.
 *
 * Returns `null` rather than `undefined` for the absent case, so that
 * `generateDeviceId(null)` can force the weak path in a test. Passing `undefined` to a
 * parameter with a default silently selects the default instead, which would make the
 * fallback untestable.
 */
function resolveCrypto(): CryptoLike | null {
  return (globalThis as { crypto?: CryptoLike }).crypto ?? null;
}

/** Render bytes as lowercase hex. */
function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/** 128 bits from `Math.random`. Not cryptographically strong; see the module header. */
function weakHex(length: number): string {
  let hex = '';
  while (hex.length < length) {
    hex += Math.floor(Math.random() * 0x1_0000_0000)
      .toString(16)
      .padStart(8, '0');
  }
  return hex.slice(0, length);
}

/**
 * Mint a new device id.
 *
 * The id is `atlas-` plus 32 lowercase hex characters: 38 characters, comfortably
 * inside the server's 8–128 bound, and prefixed so that an id appearing in a log or a
 * database row is recognisable as ours rather than as an arbitrary token.
 *
 * @param cryptoSource - WebCrypto to use. Defaults to the runtime's, if any; tests
 *                       pass a stub, or `null` to exercise the weak path.
 * @returns The id and the quality of the entropy behind it. Side effects: consumes
 *          randomness.
 */
export function generateDeviceId(
  cryptoSource: CryptoLike | null = resolveCrypto(),
): GeneratedDeviceId {
  if (cryptoSource !== null) {
    const uuid = cryptoSource.randomUUID?.();
    if (typeof uuid === 'string' && uuid.length > 0) {
      return { deviceId: `atlas-${uuid.replace(/-/g, '').toLowerCase()}`, quality: 'strong' };
    }

    const fill = cryptoSource.getRandomValues;
    if (fill !== undefined) {
      const bytes = fill.call(cryptoSource, new Uint8Array(DEVICE_ID_HEX_LENGTH / 2));
      return { deviceId: `atlas-${toHex(bytes)}`, quality: 'strong' };
    }
  }

  return { deviceId: `atlas-${weakHex(DEVICE_ID_HEX_LENGTH)}`, quality: 'weak' };
}
