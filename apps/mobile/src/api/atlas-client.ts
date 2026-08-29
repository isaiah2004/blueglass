/**
 * The API layer's composition root: the one place the pieces are wired together.
 *
 * Purpose
 *   Every other module in `src/api` takes its collaborators as parameters, which is what
 *   makes them testable under Node with no platform at all. Somewhere, though, an actual
 *   object has to be built from actual defaults — a real `fetch`, the real device
 *   identity, the real base URL. This file is that somewhere, and it is deliberately
 *   the only one.
 *
 * What "swap in real accounts" costs, concretely (decision `A-01`)
 *   One line here: `headers: accountAuthHeaders` instead of `deviceIdentityHeaders`.
 *   No endpoint, hook, store or component mentions identity, so nothing else changes.
 *
 * Why singletons
 *   The identity memoises its device id, and two clients would mean two memos and, on a
 *   first launch, a race to mint two ids. The query cache has the same property one
 *   layer up. One of each, created at module load, is the simplest thing that cannot go
 *   wrong that way.
 *
 * Dependencies
 *   `./client`, `./endpoints`, `./identity`.
 */

import { createHttpClient, type HttpClient } from './client';
import { createAtlasApi, type AtlasApi } from './endpoints';
import { deviceIdentityHeaders } from './identity';

/** The transport: base URL, timeouts, retries, and the identity header. */
export const atlasHttpClient: HttpClient = createHttpClient({ headers: deviceIdentityHeaders });

/** The API, bound to that transport. This is what hooks and stores call. */
export const atlasApi: AtlasApi = createAtlasApi(atlasHttpClient);
