/**
 * The two queries that ask about the service rather than about scripture.
 *
 * Purpose
 *   `GET /health` is how the app tells "the server is down" from "this chapter does not
 *   exist"; `GET /me` is how it proves the device-id header took. Both are diagnostics,
 *   both are cheap, and neither belongs in the reading canvas's file.
 *
 * Why neither is persisted
 *   `query-persistence.ts` excludes both families by name. A stored liveness answer is
 *   worthless the moment it is written, and a stored identity is one request away from
 *   being re-derived while carrying the device id into a second storage key.
 *
 * Dependencies
 *   `@tanstack/react-query`, this folder, and `../endpoints`.
 */

import { useQuery } from '@tanstack/react-query';

import { atlasApi } from '../atlas-client';
import type { ApiHealth, ApiIdentity } from '../endpoints';
import { AtlasApiException, unwrapForQuery } from './api-exception';
import { HEALTH_STALE_TIME_MS } from './query-client';
import { atlasQueryKeys } from './query-keys';
import type { AtlasQueryOptions, AtlasQueryResult } from './use-scripture-queries';

/**
 * Is the API up? (`GET /health`)
 *
 * Liveness only — it does not touch the database, so a `200` here with a failing chapter
 * read means Postgres, not the network. `GET /ready` is the one that checks the
 * database, and it is an orchestrator's business rather than a client's.
 */
export function useHealthQuery(options: AtlasQueryOptions = {}): AtlasQueryResult<ApiHealth> {
  const api = options.api ?? atlasApi;
  return useQuery<ApiHealth, AtlasApiException>({
    queryKey: atlasQueryKeys.health(),
    queryFn: async ({ signal }) => unwrapForQuery(await api.getHealth({ signal })),
    staleTime: options.staleTime ?? HEALTH_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  });
}

/**
 * Who does the server think this device is? (`GET /me`)
 *
 * The end-to-end proof of the identity seam: a `200` means the minted device id reached
 * the server and was accepted, and a `401 identity_required` means the header never
 * arrived. Worth calling once at startup precisely because the alternative is finding
 * out from the first write that fails.
 */
export function useIdentityQuery(options: AtlasQueryOptions = {}): AtlasQueryResult<ApiIdentity> {
  const api = options.api ?? atlasApi;
  return useQuery<ApiIdentity, AtlasApiException>({
    queryKey: atlasQueryKeys.identity(),
    queryFn: async ({ signal }) => unwrapForQuery(await api.getIdentity({ signal })),
    enabled: options.enabled ?? true,
  });
}
