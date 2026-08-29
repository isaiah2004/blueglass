/**
 * The badge endpoint, as one typed method.
 *
 * Purpose
 *   `GET /badges/chapters/{translation}/{book}/{chapter}` — one request per chapter, which
 *   is the shape the server deliberately chose: the reader asks "what does Acts 16 show",
 *   never "what Route badges does Acts 16 have", and five per-kind endpoints would fan out
 *   into a waterfall and push the per-verse cap into client code no server test covers.
 *
 * Why it lives here and not in `src/api/endpoints`
 *   `src/api/endpoints` is the scripture contract: six reads the whole app shares. Badges are
 *   the reading canvas's own enrichment, and keeping the call beside the models and the
 *   decoders that shape it means the badge contract can be read in one folder. It still goes
 *   through the shared `HttpClient`, so it inherits the identity header, the deadline and the
 *   retry policy rather than reimplementing any of them.
 *
 * Idempotence
 *   A `GET`, so the default retry policy is safe (rule 6.4.2).
 *
 * Dependencies
 *   `@/api` for the client and the result type, and this folder's decoder.
 */

import { atlasHttpClient, type ApiResult, type HttpClient } from '@/api';

import { decodeChapterBadges } from './badge-decoders';
import type { ChapterBadges } from './badge-models';

/** Which chapter's badges to fetch. Mirrors `ChapterAddress`, deliberately. */
export interface BadgeChapterAddress {
  /** Translation code, e.g. `BSB`. Anchor offsets belong to *this* translation. */
  readonly translation: string;
  /** Name, OSIS code, alias, or number — the server resolves all four. */
  readonly book: string | number;
  /** 1-based. */
  readonly chapter: number;
}

/** The badge surface. One method today; `GET /badges/{id}` joins it when deep links land. */
export interface BadgeApi {
  getChapterBadges(
    address: BadgeChapterAddress,
    options?: { readonly signal?: AbortSignal | undefined },
  ): Promise<ApiResult<ChapterBadges>>;
}

/**
 * Bind the badge endpoint to a transport.
 *
 * @param client - The HTTP client to call through. Defaults to the app's.
 * @returns The badge API. Side effects: none until a method is called.
 */
export function createBadgeApi(client: HttpClient = atlasHttpClient): BadgeApi {
  return {
    getChapterBadges(address, options = {}): Promise<ApiResult<ChapterBadges>> {
      const book = typeof address.book === 'number' ? String(address.book) : address.book;
      return client.request({
        path: `/badges/chapters/${address.translation}/${book}/${String(address.chapter)}`,
        decode: decodeChapterBadges,
        signal: options.signal,
      });
    },
  };
}

/** The app's badge API, bound to the shared client. */
export const badgeApi: BadgeApi = createBadgeApi();
