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

import { chromium, type FullConfig } from '@playwright/test';

import { WALKTHROUGH_RUN_DIR, WALKTHROUGH_RUN_ID } from './run-id';
import { VIEWPORTS } from './viewports';

/** How long the first cold bundle may take before the run is declared broken. */
const WARM_UP_TIMEOUT_MS = 240_000;

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
 * Load the app once in a real browser and wait for React to mount.
 *
 * @param baseURL Where the Expo web build is served.
 * @throws {Error} If the app never mounts, with the page's own title and URL attached so
 *   the failure names the difference between "server not up" and "bundle threw".
 */
async function warmUpBundle(baseURL: string): Promise<void> {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: WARM_UP_TIMEOUT_MS });
    await page
      .waitForFunction(
        () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
        undefined,
        { timeout: WARM_UP_TIMEOUT_MS },
      )
      .catch((cause: unknown) => {
        throw new Error(
          `The Expo web build at ${baseURL} never mounted anything into #root within ` +
            `${String(WARM_UP_TIMEOUT_MS / 1000)}s. The server answered, so this is a bundle or ` +
            'runtime failure rather than a missing server. Run `pnpm web` and open the URL to see it.',
          { cause },
        );
      });
  } finally {
    await browser.close();
  }
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
