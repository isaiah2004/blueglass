/**
 * The Atlas Bible API, as six typed methods.
 *
 * Purpose
 *   The whole surface the client calls, in one object. A hook, a store, or a test asks
 *   for an {@link AtlasApi} and never sees a URL, a header, or a status code — which is
 *   what makes every one of them substitutable with an in-memory double.
 *
 * Endpoints, and where the contract lives
 *   | method             | route                                        | server module |
 *   |--------------------|----------------------------------------------|---------------|
 *   | `getHealth`        | `GET /health`                                | `health`      |
 *   | `getTranslations`  | `GET /translations`                          | `scripture`   |
 *   | `getBooks`         | `GET /books`                                 | `scripture`   |
 *   | `getChapter`       | `GET /chapters/{translation}/{book}/{chapter}` | `scripture` |
 *   | `search`           | `GET /search`                                | `scripture`   |
 *   | `getIdentity`      | `GET /me`                                    | `identity`    |
 *
 *   Every one is a `GET`, so every one is idempotent and safe to retry (rule 6.4.2).
 *   The first write endpoint added here must pass `NO_RETRY_POLICY` or carry an
 *   idempotency key.
 *
 * A note on the chapter route
 *   The translation is part of the path, not a query parameter — it identifies the
 *   resource. That is a deliberate departure from the prototype's
 *   `GET /read/{book}/{chapter}?translation=`, recorded in the server's own router
 *   docstring. The `book` segment stays tolerant: a name, an OSIS code, an alias, or a
 *   number all resolve, so the reader can route by whatever it has.
 *
 * Dependencies
 *   `../client` and this folder's decoders. No React, no storage, no platform.
 */

import {
  HEALTH_API_TIMEOUT_MS,
  SEARCH_API_TIMEOUT_MS,
  type ApiResult,
  type HttpClient,
} from '../client';
import { decodeHealth, decodeIdentity } from './meta-decoders';
import type {
  ApiBook,
  ApiChapter,
  ApiHealth,
  ApiIdentity,
  ApiSearchResults,
  ApiTranslation,
} from './models';
import {
  decodeBooks,
  decodeChapter,
  decodeSearchResults,
  decodeTranslations,
} from './scripture-decoders';

/** Per-call options every method accepts. */
export interface RequestOptions {
  /** Cancels the request and any backoff wait. TanStack Query supplies one. */
  readonly signal?: AbortSignal | undefined;
}

/** Which chapter to read. */
export interface ChapterAddress {
  /** Translation code, e.g. `BSB`. */
  readonly translation: string;
  /** Name, OSIS code, alias, or number — the server resolves all four. */
  readonly book: string | number;
  /** 1-based. */
  readonly chapter: number;
}

/** What to search for. */
export interface SearchQuery {
  readonly query: string;
  /** Defaults server-side to the configured default translation. */
  readonly translation?: string | undefined;
  /** `all`, or a book token to search one book. Defaults to `all`. */
  readonly scope?: string | undefined;
  /** Rows to return. The server clamps to its own ceiling rather than erroring. */
  readonly limit?: number | undefined;
}

/** The API surface. */
export interface AtlasApi {
  /** Liveness. Short budget: this exists to fail fast, not to succeed slowly. */
  getHealth(options?: RequestOptions): Promise<ApiResult<ApiHealth>>;
  /** The translations that actually have verses loaded. Drives the switcher. */
  getTranslations(options?: RequestOptions): Promise<ApiResult<readonly ApiTranslation[]>>;
  /** The 66-book canon. Served from the server's domain table, so it never 404s. */
  getBooks(options?: RequestOptions): Promise<ApiResult<readonly ApiBook[]>>;
  /** Every verse of one chapter. */
  getChapter(address: ChapterAddress, options?: RequestOptions): Promise<ApiResult<ApiChapter>>;
  /** Full-text scripture search. */
  search(query: SearchQuery, options?: RequestOptions): Promise<ApiResult<ApiSearchResults>>;
  /** Who the server thinks this device is. Proves the identity header took. */
  getIdentity(options?: RequestOptions): Promise<ApiResult<ApiIdentity>>;
}

/**
 * The four scripture reads.
 *
 * Split from {@link createAtlasApi} so no function in this module exceeds the 50-line
 * limit, and because these four share a property the other two do not: they are the ones
 * whose answers are worth caching for a week.
 *
 * @param client - The transport to call through.
 * @returns The scripture half of {@link AtlasApi}. Side effects: none.
 */
function createScriptureMethods(
  client: HttpClient,
): Pick<AtlasApi, 'getTranslations' | 'getBooks' | 'getChapter' | 'search'> {
  return {
    getTranslations(options = {}): Promise<ApiResult<readonly ApiTranslation[]>> {
      return client.request({
        path: '/translations',
        decode: decodeTranslations,
        signal: options.signal,
      });
    },

    getBooks(options = {}): Promise<ApiResult<readonly ApiBook[]>> {
      return client.request({ path: '/books', decode: decodeBooks, signal: options.signal });
    },

    getChapter(address, options = {}): Promise<ApiResult<ApiChapter>> {
      const book = typeof address.book === 'number' ? String(address.book) : address.book;
      return client.request({
        path: `/chapters/${address.translation}/${book}/${String(address.chapter)}`,
        decode: decodeChapter,
        signal: options.signal,
      });
    },

    search(query, options = {}): Promise<ApiResult<ApiSearchResults>> {
      return client.request({
        path: '/search',
        query: {
          q: query.query,
          translation: query.translation,
          scope: query.scope,
          limit: query.limit,
        },
        decode: decodeSearchResults,
        timeoutMs: SEARCH_API_TIMEOUT_MS,
        signal: options.signal,
      });
    },
  };
}

/**
 * The two reads that describe the service rather than the scripture.
 *
 * @param client - The transport to call through.
 * @returns The meta half of {@link AtlasApi}. Side effects: none.
 */
function createMetaMethods(client: HttpClient): Pick<AtlasApi, 'getHealth' | 'getIdentity'> {
  return {
    getHealth(options = {}): Promise<ApiResult<ApiHealth>> {
      return client.request({
        path: '/health',
        decode: decodeHealth,
        timeoutMs: HEALTH_API_TIMEOUT_MS,
        signal: options.signal,
      });
    },

    getIdentity(options = {}): Promise<ApiResult<ApiIdentity>> {
      return client.request({ path: '/me', decode: decodeIdentity, signal: options.signal });
    },
  };
}

/**
 * Bind the API surface to a transport.
 *
 * @param client - The HTTP client to call through. Its identity provider decides who
 *                 the requests are from; this module never touches headers.
 * @returns The six methods. Side effects: none until a method is called.
 */
export function createAtlasApi(client: HttpClient): AtlasApi {
  return { ...createMetaMethods(client), ...createScriptureMethods(client) };
}
