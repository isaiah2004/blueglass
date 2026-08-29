/**
 * Global setup — prove the app is genuinely ready, once, before any chapter runs.
 *
 * Purpose
 *   Metro's first bundle of a cold Expo web build takes tens of seconds. Without this,
 *   whichever chapter happened to run first would absorb that cost inside its own timeout
 *   and fail for a reason that has nothing to do with what it was testing — the classic
 *   "first test is always flaky" that teaches a team to ignore its own harness.
 *
 * What "ready" means here
 *   Not that the port accepts a socket, and not that the HTML shell returned 200: an Expo
 *   dev server answers both of those long before it can serve a bundle. Ready means a real
 *   browser loaded the page and React actually mounted something into the root element.
 *   That is a condition, polled — never a sleep.
 *
 * Why more than one route is warmed
 *   Metro compiles per route, so warming `/` warms `/` and nothing else. The diagnostic
 *   spikes are the routes nothing else in the app imports, and `inline-badge-spike.spec.ts`
 *   duly failed run after run at desktop with "Test timeout of 90000ms exceeded while
 *   running beforeEach hook" — 1.6 minutes burned inside a test's own budget compiling a
 *   bundle. Raising the budget would have hidden it in the number the harness reports;
 *   warming the route puts the cost where this file already says it belongs, once, before
 *   any chapter runs. The reader routes are left cold on purpose: they are compiled by the
 *   first chapter that opens one, and that chapter is measuring the reader anyway.
 *
 * Also written here
 *   `run.json` in the run directory, so a folder of screenshots carries its own provenance:
 *   which run, which base URL, which viewports, when.
 *
 * Dependencies
 *   `@playwright/test`'s bundled Chromium driver, pointed at the installed Chrome via
 *   `channel: 'chrome'` (`docs/decisions/DECISIONS.md` A-8 — packages, never software).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { chromium, type FullConfig, type Page } from '@playwright/test';

import { WALKTHROUGH_RUN_DIR, WALKTHROUGH_RUN_ID } from './run-id';
import { VIEWPORTS } from './viewports';

/** How long the first cold bundle may take before the run is declared broken. */
const WARM_UP_TIMEOUT_MS = 240_000;

/**
 * Routes compiled here rather than inside a test's own timeout.
 *
 * `/` is the app shell every chapter needs. The two spikes are diagnostic routes that
 * nothing else imports, so each is a Metro compile of its own the first time it is opened
 * — which is the whole of the `inline-badge-spike` failure.
 */
const WARM_UP_PATHS: readonly string[] = ['/', '/spike/badges', '/spike/textual-sheets'];

/**
 * Record what this run is, alongside its screenshots.
 *
 * @param baseURL The URL the run drove.
 */
async function writeRunManifest(baseURL: string): Promise<void> {
  await mkdir(WALKTHROUGH_RUN_DIR, { recursive: true });
  const manifest = {
    runId: WALKTHROUGH_RUN_ID,
    startedAt: new Date().toISOString(),
    baseURL,
    warmedPaths: [...WARM_UP_PATHS],
    viewports: VIEWPORTS.map((viewport) => ({
      name: viewport.name,
      width: viewport.width,
      height: viewport.height,
      regime: viewport.regime,
    })),
  };
  await writeFile(join(WALKTHROUGH_RUN_DIR, 'run.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Load every route the suite enters cold, and wait for React to mount on each.
 *
 * @param baseURL Where the Expo web build is served.
 * @throws {Error} If a route never mounts, with the route named so the failure says the
 *   difference between "server not up" and "that bundle threw".
 */
async function warmUpBundle(baseURL: string): Promise<void> {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    for (const path of WARM_UP_PATHS) {
      await warmUpRoute(page, new URL(path, baseURL).href);
    }
  } finally {
    await browser.close();
  }
}

/**
 * Compile and mount one route.
 *
 * @param page The browser page to drive.
 * @param url The absolute URL of the route.
 * @throws {Error} If nothing mounts into `#root` within the warm-up budget.
 */
async function warmUpRoute(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: WARM_UP_TIMEOUT_MS });
  await page
    .waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      undefined,
      {
        timeout: WARM_UP_TIMEOUT_MS,
      },
    )
    .catch((cause: unknown) => {
      throw new Error(
        `The Expo web build never mounted anything into #root at ${url} within ` +
          `${String(WARM_UP_TIMEOUT_MS / 1000)}s. The server answered, so this is a bundle or ` +
          'runtime failure rather than a missing server. Run `pnpm web` and open the URL to see it.',
        { cause },
      );
    });
}

/**
 * Playwright's global setup entry point.
 *
 * @param config The resolved Playwright configuration.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:8081';
  await writeRunManifest(baseURL);
  await warmUpBundle(baseURL);
}
