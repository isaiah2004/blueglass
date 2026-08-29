/**
 * Playwright configuration for the Atlas Bible web build.
 *
 * Purpose
 *   Drives the continuous, unattended walkthrough loop against `expo start --web`
 *   (`Q-04`: the web build in a headless browser, continuously; CLAUDE.md "The walkthrough
 *   loop"). This file owns three things and nothing else: which browser, which viewports,
 *   and how the server gets started.
 *
 * The browser
 *   `channel: 'chrome'` drives the Chrome already installed on this machine. `npx playwright
 *   install` is forbidden — it downloads software, and the standing constraint is packages
 *   only (`docs/decisions/DECISIONS.md` §1.3, A-8). There is no first-run download step.
 *
 * The three projects
 *   `Q-006` reinstated full phone / tablet / desktop parity, so every chapter runs at all
 *   three widths by default. A chapter that only makes sense at one width skips itself on
 *   the others; nothing is excluded here, because an exclusion in the config is invisible
 *   from the spec that it silences.
 *
 * The server
 *   `webServer` starts the Expo web build itself, because an unattended loop cannot depend
 *   on a human having run `pnpm web` first, and reuses one that is already running so the
 *   loop can be re-run a hundred times without cleanup. `e2e/run-walkthrough.mjs` is the
 *   supported entry point and manages the same server explicitly, including teardown on
 *   failure; running `pnpm e2e` directly still works and lets Playwright do it.
 *
 * Related
 *   `docs/qa/WALKTHROUGH.md` — what the suite covers, how to run it, what it does not cover.
 */

import { defineConfig } from '@playwright/test';

import type { WalkthroughOptions } from './e2e/support/fixtures';
import { WALKTHROUGH_RUN_DIR } from './e2e/support/run-id';
import { VIEWPORTS } from './e2e/support/viewports';

/** Where `expo start --web` serves the app during a walkthrough. */
const WEB_BASE_URL = process.env.ATLAS_WEB_BASE_URL ?? 'http://localhost:8081';

/**
 * One Playwright project per viewport.
 *
 * `deviceScaleFactor` stays at 1 deliberately: the screenshots are evidence a human flips
 * through, and a 3x phone screenshot is nine times the bytes for no extra information.
 */
const projects = VIEWPORTS.map((viewport) => ({
  name: viewport.name,
  use: {
    viewportName: viewport.name,
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.hasTouch,
    channel: 'chrome' as const,
  },
}));

export default defineConfig<WalkthroughOptions>({
  testDir: './e2e',
  globalSetup: './e2e/support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // `OP-01`: no CI. A retry locally would hide exactly the flake this harness must expose.
  retries: 0,
  ...(process.env.ATLAS_E2E_WORKERS === undefined
    ? {}
    : { workers: Number(process.env.ATLAS_E2E_WORKERS) }),
  // Metro can rebuild mid-run when a sibling agent saves a file, so a step gets a generous
  // budget; the assertions themselves stay short so a genuinely missing element fails fast.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: `${WALKTHROUGH_RUN_DIR}/results.json` }]],
  outputDir: './test-results',
  use: {
    baseURL: WEB_BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects,
  webServer: {
    command: 'pnpm --filter @atlas/mobile run web',
    url: WEB_BASE_URL,
    reuseExistingServer: true,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
