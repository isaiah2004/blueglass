/**
 * Cutting the API off, deterministically.
 *
 * Purpose
 *   The walkthrough has to prove the UI degrades honestly when the backend is gone. The
 *   obvious way is `docker compose stop api`, and it is the wrong way: it takes seconds to
 *   stop and longer to come back, it is shared state that breaks every other test running
 *   in parallel, and a run interrupted halfway leaves the developer's stack down. Cutting
 *   the connection inside the browser is the same fact from the app's point of view — the
 *   request never reaches anything — and it is instant, isolated, and always undone.
 *
 * What counts as "the API"
 *   Anything the page requests from an origin other than its own, plus any `/api/` path.
 *   The Expo dev server serves the bundle from the page's own origin and the API answers on
 *   a different port, so the split is exact and needs no hardcoded host.
 *
 * The guard that keeps this honest
 *   {@link ApiOutage.attempts} counts what was intercepted. A chapter asserts it is greater
 *   than zero before concluding anything about an error state, so "the reader shows no
 *   error when the API is down" can never be reported when the truth is "the reader never
 *   asked the API for anything".
 *
 * Dependencies
 *   `@playwright/test` for `Page` and `Route`.
 */

import type { Page, Route } from '@playwright/test';

/** How an outage behaves. */
export type OutageMode =
  /** The connection is refused, as if the process were not running. */
  | 'unreachable'
  /** The server answers, badly. */
  | 'server-error';

/** A live outage, and the handle that ends it. */
export interface ApiOutage {
  /** How many API requests have been intercepted since the outage began. */
  readonly attempts: () => number;
  /** The URLs intercepted, for a failure message that names what the app was asking for. */
  readonly urls: () => readonly string[];
  /** Restore the API. Safe to call more than once. */
  readonly restore: () => Promise<void>;
}

/**
 * Is this request bound for the API rather than for the app's own bundle?
 *
 * @param requestUrl The absolute request URL.
 * @param pageOrigin The origin the page itself was served from.
 * @returns True when the request is cross-origin or on an `/api/` path.
 */
function isApiRequest(requestUrl: string, pageOrigin: string): boolean {
  try {
    const parsed = new URL(requestUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return parsed.origin !== pageOrigin || parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/**
 * Cut the page off from the API until the returned handle is restored.
 *
 * @param page The page to cut off.
 * @param mode Whether the API is unreachable or merely broken.
 * @returns The live outage.
 */
export async function cutTheApi(page: Page, mode: OutageMode = 'unreachable'): Promise<ApiOutage> {
  const pageOrigin = new URL(page.url()).origin;
  const intercepted: string[] = [];
  let restored = false;

  const handler = async (route: Route): Promise<void> => {
    const url = route.request().url();
    if (!isApiRequest(url, pageOrigin)) {
      await route.fallback();
      return;
    }
    intercepted.push(url);
    if (mode === 'unreachable') {
      await route.abort('connectionrefused');
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'service_unavailable', message: 'API is down' } }),
    });
  };

  await page.route('**/*', handler);

  return {
    attempts: (): number => intercepted.length,
    urls: (): readonly string[] => intercepted,
    restore: async (): Promise<void> => {
      if (restored) return;
      restored = true;
      await page.unroute('**/*', handler);
    },
  };
}
