/**
 * Decoders for the two endpoints that describe the system rather than the scripture.
 *
 * Purpose
 *   `GET /health` and `GET /me` are small, and they are the two responses whose *shape*
 *   the client most needs to be sure of: one is how the app decides it is online, the
 *   other is how it confirms its identity header took. Keeping them out of
 *   `scripture-decoders.ts` keeps that file about one contract.
 *
 * Dependencies
 *   The decoder combinators and the client models.
 */

import { decodeObject, decodeString, type Decoder } from '../client';
import type { ApiHealth, ApiIdentity } from './models';

/**
 * `GET /health` → liveness.
 *
 * All four fields are required even though only `status` is read today: an endpoint that
 * answers with three of them is not the endpoint this client was written against, and
 * finding that out at the probe is much cheaper than finding it out in the reader.
 */
export const decodeHealth: Decoder<ApiHealth> = decodeObject<ApiHealth>({
  status: decodeString,
  service: decodeString,
  version: decodeString,
  environment: decodeString,
});

/**
 * `GET /me` → the identity the server resolved from the device-id header.
 *
 * `kind` stays a plain string rather than a `'device' | 'account'` union. The server
 * will grow the second value when real accounts land (decision `A-01`), and a client
 * that fails to decode the day the server starts sending `account` would be a very
 * expensive way to have been precise.
 */
export const decodeIdentity: Decoder<ApiIdentity> = decodeObject<ApiIdentity>({
  subject: decodeString,
  kind: decodeString,
});
