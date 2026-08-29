/**
 * Tests for minting and validating a device id.
 *
 * What these prove
 *   - The validator is the server's, character for character. A client that mints an id
 *     its own server rejects fails on the first request of a first launch, which is the
 *     worst possible time to find out.
 *   - Every entropy path produces a valid id, including the weak fallback, and each
 *     reports its quality honestly rather than claiming to be strong.
 *   - Two mints never collide.
 */

import { describe, expect, it, vi } from 'vitest';

import { generateDeviceId, isValidDeviceId } from './device-id';

describe('isValidDeviceId', () => {
  it('accepts the alphabet and length the server accepts', () => {
    // Mirrors `_DEVICE_ID` in apps/api/.../identity/domain/identity.py:
    // ^[A-Za-z0-9._:-]{8,128}$
    expect(isValidDeviceId('abcdefgh')).toBe(true);
    expect(isValidDeviceId('a.b:c_d-E9')).toBe(true);
    expect(isValidDeviceId('x'.repeat(128))).toBe(true);
  });

  it('rejects anything the server would reject', () => {
    expect(isValidDeviceId('short')).toBe(false);
    expect(isValidDeviceId('x'.repeat(129))).toBe(false);
    expect(isValidDeviceId('has space')).toBe(false);
    expect(isValidDeviceId('has/slash')).toBe(false);
    expect(isValidDeviceId('')).toBe(false);
  });
});

describe('generateDeviceId', () => {
  it('uses randomUUID when the runtime has one, and calls the result strong', () => {
    const randomUUID = vi.fn(() => '2f9c8a1e-0000-4000-8000-000000000001');

    const generated = generateDeviceId({ randomUUID });

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(generated.quality).toBe('strong');
    expect(generated.deviceId).toBe('atlas-2f9c8a1e000040008000000000000001');
    expect(isValidDeviceId(generated.deviceId)).toBe(true);
  });

  it('falls back to getRandomValues, and still calls it strong', () => {
    let fills = 0;
    const getRandomValues = <TArray extends Uint8Array>(array: TArray): TArray => {
      fills += 1;
      array.fill(0xab);
      return array;
    };

    const generated = generateDeviceId({ getRandomValues });

    expect(fills).toBe(1);
    expect(generated).toEqual({ deviceId: `atlas-${'ab'.repeat(16)}`, quality: 'strong' });
  });

  it('falls back to Math.random when the runtime has no crypto, and says so', () => {
    const generated = generateDeviceId(null);

    expect(generated.quality).toBe('weak');
    expect(isValidDeviceId(generated.deviceId)).toBe(true);
    expect(generated.deviceId).toMatch(/^atlas-[0-9a-f]{32}$/);
  });

  it('does not collide across many mints', () => {
    const minted = new Set(Array.from({ length: 500 }, () => generateDeviceId().deviceId));

    expect(minted.size).toBe(500);
  });
});
