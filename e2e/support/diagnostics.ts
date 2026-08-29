/**
 * Console and network diagnostics for one page.
 *
 * Purpose
 *   A React tree can throw inside an effect, log the stack, and carry on rendering. The
 *   screen looks right, the assertions pass, and the only evidence is in a console nobody
 *   reads. The same is true of a request that 500s behind a component which quietly renders
 *   its empty state. This watcher makes both loud: every step of every chapter ends with a
 *   clean-console assertion, so the first screen that produces an error is the one that
 *   fails.
 *
 * Allowlists, and why they are narrow
 *   The Expo dev server and Chrome both emit noise that is not the app's fault. Each
 *   allowlist entry below names exactly what it is forgiving and why. An allowlist that
 *   grows to silence a real error is how a harness stops being worth running, so entries
 *   are added only for messages the app cannot influence.
 *
 * Dependencies
 *   `@playwright/test` for `expect` and the page event types.
 */

import {
  expect,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';

/** Console messages that are the toolchain talking, not the app failing. */
const CONSOLE_ALLOWLIST: readonly RegExp[] = [
  // React's own advertisement for its browser extension, logged on every dev boot.
  /Download the React DevTools/i,
  // Metro's Fast Refresh chatter during a dev-server rebuild.
  /\[Fast Refresh\]/i,
  // Chrome asks every localhost origin for this file; the dev server has no opinion on it.
  /com\.chrome\.devtools\.json/i,
];

/**
 * Failure reasons that are the app working, not the app failing.
 *
 * `net::ERR_ABORTED` is what a *cancelled* request looks like to Chrome, and the client
 * cancels on purpose: every `queryFn` forwards TanStack's `signal`, so leaving a chapter
 * aborts its in-flight fetch rather than letting a stale answer land
 * (`src/api/query/use-scripture-queries.ts`, "Cancellation"). Counting that as a failed
 * request made correct cancellation indistinguishable from a broken server, and reported
 * four failures for a tab walk in which nothing went wrong.
 *
 * It is matched on the failure text, not the URL, so a request that genuinely fails to the
 * same endpoint is still reported.
 */
const FAILURE_REASON_ALLOWLIST: readonly RegExp[] = [/net::ERR_ABORTED/];

/** Requests whose failure says nothing about the app. */
const REQUEST_ALLOWLIST: readonly RegExp[] = [
  // No favicon is bundled for the dev build; the 404 is expected and harmless.
  /\/favicon\.ico(\?|$)/i,
  // Source maps are fetched by devtools, not by the app.
  /\.map(\?|$)/i,
  // Chrome's automatic devtools probe, again.
  /\/\.well-known\/appspecific\//i,
  // Metro's hot-reload socket closes on every navigation.
  /\/hot(\?|$)/i,
];

/** A live record of what a page complained about. */
export interface Diagnostics {
  /** Console errors and uncaught page errors seen so far, allowlists already applied. */
  readonly consoleErrors: readonly string[];
  /** Requests that failed or returned >= 400, allowlists already applied. */
  readonly failedRequests: readonly string[];
  /** Forgive further console errors matching a pattern, for a step that provokes one. */
  allowConsole: (pattern: RegExp) => void;
  /** Forgive further request failures matching a pattern, e.g. the API a test just cut. */
  allowRequests: (pattern: RegExp) => void;
  /** Fail the test if anything unforgiven was recorded. */
  assertClean: (label: string) => void;
  /** Drop everything recorded so far, without changing the allowlists. */
  reset: () => void;
}

/**
 * Decide whether a message is forgiven.
 *
 * @param text The message or URL.
 * @param patterns The patterns in force.
 * @returns True when at least one pattern matches.
 */
function isAllowed(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Start watching a page for console errors and failed requests.
 *
 * Listeners are attached for the life of the page and never removed; a Playwright page is
 * per-test, so there is nothing to leak between tests.
 *
 * @param page The page to watch.
 * @returns The live diagnostics record.
 */
export function watchPage(page: Page): Diagnostics {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const consolePatterns: RegExp[] = [...CONSOLE_ALLOWLIST];
  const requestPatterns: RegExp[] = [...REQUEST_ALLOWLIST];

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!isAllowed(text, consolePatterns)) consoleErrors.push(text);
  });
  page.on('pageerror', (error: Error) => {
    const text = `uncaught ${error.name}: ${error.message}`;
    if (!isAllowed(text, consolePatterns)) consoleErrors.push(text);
  });
  page.on('requestfailed', (request: Request) => {
    const reason = request.failure()?.errorText ?? 'unknown';
    const text = `${request.method()} ${request.url()} failed: ${reason}`;
    if (isAllowed(reason, FAILURE_REASON_ALLOWLIST)) return;
    if (!isAllowed(request.url(), requestPatterns)) failedRequests.push(text);
  });
  page.on('response', (response: Response) => {
    if (response.status() < 400) return;
    const text = `${String(response.status())} ${response.url()}`;
    if (!isAllowed(response.url(), requestPatterns)) failedRequests.push(text);
  });

  return {
    get consoleErrors() {
      return consoleErrors;
    },
    get failedRequests() {
      return failedRequests;
    },
    allowConsole: (pattern: RegExp): void => void consolePatterns.push(pattern),
    allowRequests: (pattern: RegExp): void => void requestPatterns.push(pattern),
    assertClean: (label: string): void => {
      expect(consoleErrors, `console errors — ${label}`).toEqual([]);
      expect(failedRequests, `failed network requests — ${label}`).toEqual([]);
    },
    reset: (): void => {
      consoleErrors.length = 0;
      failedRequests.length = 0;
    },
  };
}
