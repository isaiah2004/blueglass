/**
 * The one object every endpoint module talks through.
 *
 * Purpose
 *   Assemble a request — base URL, path, query, headers, body — hand it to the retry
 *   loop, and give the caller a typed result. Everything the port map's risk #9 says the
 *   Flutter client never did (an identity header on every request) and everything rules
 *   6.4.1 and 6.4.2 require (a timeout on every request, bounded retries with jittered
 *   backoff) happens here, once, rather than in twenty-three call sites.
 *
 * Key responsibilities
 *   - Resolve the identity headers before each attempt, so a device id minted during
 *     startup is picked up by a request that was already queued.
 *   - Apply a default timeout and retry policy, overridable per request.
 *   - Return {@link ApiResult}. Nothing here throws, and nothing here rejects.
 *
 * What it deliberately does not do
 *   Cache, deduplicate, or decide when to refetch. That is TanStack Query's job
 *   (`src/api/query`), and mixing the two would give the app two caches that disagree.
 *
 * Dependencies
 *   Its own folder plus the shared `TimerApi`. No React, no React Native, no storage:
 *   the identity headers arrive through an injected provider, which is what lets this
 *   whole module be tested under Node with a fake `fetch`.
 *
 * Usage
 *   ```ts
 *   const client = createHttpClient({ headers: deviceIdentityHeaders });
 *   const chapter = await client.request({ path: '/books', decode: decodeBookList });
 *   ```
 */

import { DEFAULT_API_TIMEOUT_MS, resolveApiBaseUrl } from './api-config';
import type { ApiResult } from './api-result';
import { performRequestAttempt, type FetchLike } from './http-attempt';
import type { Decoder } from './json-shape';
import { buildRequestUrl, type QueryParameters } from './request-url';
import { runWithRetry, type Sleep } from './retry';
import { DEFAULT_RETRY_POLICY, type RandomSource, type RetryPolicy } from './retry-policy';
import type { TimerApi } from '../stream/idle-watchdog';

/** HTTP methods this client sends. Streaming lives in `src/api/stream`. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Supplies the headers that identify the caller.
 *
 * Asynchronous because the device id is read from persistent storage, and that store is
 * asynchronous by contract. **This is the seam decision `A-01` names**: swapping the
 * anonymous device id for a real account token is a new implementation of this one
 * function type, not a change to any endpoint.
 */
export type HeaderProvider = () => Promise<Readonly<Record<string, string>>>;

/** One request, fully described. */
export interface HttpRequest<TValue> {
  /** Path beginning with `/`. Segments are percent-encoded for you. */
  readonly path: string;
  /** Defaults to `GET`. */
  readonly method?: HttpMethod | undefined;
  readonly query?: QueryParameters | undefined;
  /** Serialised as JSON. Omit for a bodyless method. */
  readonly body?: unknown;
  /** Turns the 2xx body into the value. */
  readonly decode: Decoder<TValue>;
  /** Overrides the client's default budget. */
  readonly timeoutMs?: number | undefined;
  /**
   * Overrides the client's default policy.
   *
   * Pass `NO_RETRY_POLICY` for anything that is not idempotent (rule 6.4.2).
   */
  readonly policy?: RetryPolicy | undefined;
  /**
   * Cancels the request, and any backoff wait in progress.
   *
   * Typed `| undefined` rather than left merely optional: `exactOptionalPropertyTypes`
   * is on, and every caller forwards an optional signal of its own.
   */
  readonly signal?: AbortSignal | undefined;
}

/** What endpoint modules hold. */
export interface HttpClient {
  /** The base URL every request is joined onto. Exposed for diagnostics. */
  readonly baseUrl: string;
  request<TValue>(spec: HttpRequest<TValue>): Promise<ApiResult<TValue>>;
}

/** Construction options. Every one has a working default. */
export interface HttpClientOptions {
  /** Defaults to `EXPO_PUBLIC_API_URL`, else the local API port. */
  readonly baseUrl?: string;
  /** Defaults to the global `fetch`. Tests pass a double. */
  readonly fetchImpl?: FetchLike;
  /** Identity headers. Defaults to none, which only the health probe can use. */
  readonly headers?: HeaderProvider;
  readonly timeoutMs?: number;
  readonly policy?: RetryPolicy;
  /** Backoff wait. Tests pass a double to run the loop with no real delay. */
  readonly sleep?: Sleep;
  /** Jitter source. Tests pass a deterministic one. */
  readonly random?: RandomSource;
  /** Timer implementation for the per-attempt deadline. */
  readonly timers?: TimerApi;
}

/** Headers every request carries, before the identity provider adds its own. */
const BASE_HEADERS: Readonly<Record<string, string>> = { Accept: 'application/json' };

/** No identity — the default, and all the health probe needs. */
const noHeaders: HeaderProvider = () => Promise.resolve({});

/** Serialise a body and declare its type, or return nothing for a bodyless request. */
function serialiseBody(body: unknown): { text: string; contentType: string } | null {
  if (body === undefined) return null;
  return { text: JSON.stringify(body), contentType: 'application/json' };
}

/**
 * Build the client.
 *
 * @param options - Overrides. Everything defaults to the shipping configuration.
 * @returns A client. Cheap to create, but create one per app: the identity provider
 *          behind it memoises, and two clients would mint two device ids.
 */
export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const baseUrl = resolveApiBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const headerProvider = options.headers ?? noHeaders;
  const defaultTimeoutMs = options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const defaultPolicy = options.policy ?? DEFAULT_RETRY_POLICY;

  async function request<TValue>(spec: HttpRequest<TValue>): Promise<ApiResult<TValue>> {
    const url = buildRequestUrl(baseUrl, spec.path, spec.query ?? {});
    const serialised = serialiseBody(spec.body);

    return runWithRetry<TValue>(
      async () => {
        const identity = await headerProvider();
        return performRequestAttempt<TValue>(
          {
            url,
            method: spec.method ?? 'GET',
            headers: {
              ...BASE_HEADERS,
              ...(serialised === null ? {} : { 'Content-Type': serialised.contentType }),
              ...identity,
            },
            body: serialised?.text,
            timeoutMs: spec.timeoutMs ?? defaultTimeoutMs,
            signal: spec.signal,
            fetchImpl,
            timers: options.timers,
          },
          spec.decode,
        );
      },
      {
        policy: spec.policy ?? defaultPolicy,
        sleep: options.sleep,
        random: options.random,
        signal: spec.signal,
      },
    );
  }

  return { baseUrl, request };
}
