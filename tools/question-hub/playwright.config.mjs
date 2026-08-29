/**
 * Playwright configuration for the Question Hub only.
 *
 * Deliberately separate from the repo's root `playwright.config.ts`, which drives the
 * Atlas Bible web build against `expo start --web`. The two suites share nothing but the
 * `@playwright/test` package, and a shared config would couple the hub's test runs to the
 * app workflow — a three-way collision the ownership map exists to prevent.
 *
 * Run with:  npx playwright test --config tools/question-hub/playwright.config.mjs
 * Or simply: node tools/question-hub/tests/smoke.mjs
 *
 * There is no `webServer` block on purpose. Each test boots its OWN hub against its OWN
 * temp directory (see tests/e2e/hub-fixture.ts), because a shared server would let one
 * test's saved answers decide another test's result. Boot cost is ~150 ms.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices, chromium } from '@playwright/test';

/**
 * Use a Chromium that is already on this machine rather than downloading one.
 *
 * `@playwright/test` pins a browser revision, and a package bump leaves the previously
 * downloaded builds behind. Falling back to the newest installed Chromium keeps the suite
 * runnable on a workstation that has not re-run `playwright install`, which matters here:
 * the hub is a tool the fleet depends on, and its tests should not be gated on a download.
 * Set HUB_CHROME to point at a specific binary.
 */
function resolveChrome() {
  if (process.env.HUB_CHROME) return process.env.HUB_CHROME;
  try {
    if (existsSync(chromium.executablePath())) return undefined; // the pinned build is present
  } catch (err) {
    // `executablePath()` throws when no browser has ever been installed. That is a normal
    // state on a fresh workstation, not a failure — but rule 6.1.1 allows no silent catch, and
    // saying which branch was taken is what turns "no tests ran" into a one-line diagnosis.
    console.warn('[hub] no pinned Playwright browser found (' + err.message + '); looking for an installed Chromium.');
  }

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ??
    join(process.env.LOCALAPPDATA ?? process.env.HOME ?? '', 'ms-playwright');
  if (!existsSync(root)) return undefined;

  const candidates = readdirSync(root)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    .flatMap((name) => ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome']
      .map((exe) => join(root, name, exe)));

  return candidates.find((path) => existsSync(path));
}

const executablePath = resolveChrome();
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './tests/e2e/.artifacts',

  // Every test spawns a Node server on a port it owns. Serial execution keeps port
  // allocation and failure attribution simple; the whole suite runs in well under a minute.
  fullyParallel: false,
  workers: 1,

  // No retries anywhere. A test that only passes on the second attempt is a test that
  // depends on timing, and this suite is meant to catch exactly that.
  retries: 0,
  forbidOnly: Boolean(process.env.CI),

  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  expect: { timeout: 7000 },
  timeout: 45000,

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      // The device that actually matters: this is answered one-handed, on a phone.
      name: 'phone',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, launchOptions },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, launchOptions },
    },
  ],
});
