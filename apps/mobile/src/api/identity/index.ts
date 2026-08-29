/**
 * Who this client says it is.
 *
 * Purpose
 *   The public surface of `src/api/identity`: the anonymous device id of decision
 *   `A-01`, the header it travels in, and the provider the HTTP client calls before
 *   every attempt.
 *
 * Where to look when accounts arrive
 *   `device-identity.ts`. Real accounts are a second implementation of the same
 *   `HeaderProvider` function type, chosen at the composition root. Nothing in
 *   `src/api/endpoints`, `src/api/query` or `src/stores` mentions identity at all, and
 *   that is the property this folder exists to preserve.
 *
 * Usage
 *   ```ts
 *   import { deviceIdentityHeaders } from '@/api/identity';
 *   const client = createHttpClient({ headers: deviceIdentityHeaders });
 *   ```
 */

export {
  DEVICE_ID_HEADER,
  generateDeviceId,
  isValidDeviceId,
  type DeviceIdQuality,
  type GeneratedDeviceId,
} from './device-id';

export {
  createDeviceIdentity,
  deviceIdentity,
  deviceIdentityHeaders,
  type DeviceIdentity,
  type DeviceIdentityOptions,
  type ResolvedDeviceIdentity,
} from './device-identity';
