/**
 * The walkthrough test object — what every chapter imports instead of `@playwright/test`.
 *
 * Purpose
 *   Three things must be true of every chapter without the chapter having to arrange them:
 *   the page is watched for console errors and failed requests from the first byte, the
 *   viewport it is running at is known by name so a failure message can say which layout
 *   regime broke, and each step photographs and audits itself. Wiring that once here means
 *   a new chapter is a list of steps and nothing else.
 *
 * The `viewportName` option
 *   Declared as a Playwright *option*, not a fixture, so `playwright.config.ts` can set it
 *   per project. That is what lets a chapter ask "am I at phone width?" without measuring,
 *   and what keeps the screenshot folders named after the regime rather than a pixel count.
 *
 * Usage
 *   ```ts
 *   import { expect, test } from '../support/fixtures';
 *
 *   test('the reader opens', async ({ page, walkthrough }) => {
 *     await walkthrough.step('open the reader', async () => {
 *       await page.goto('/read/acts/1');
 *       await expect(page.getByTestId(READER_IDS.screen)).toBeVisible();
 *     });
 *   });
 *   ```
 *
 * Dependencies
 *   `@playwright/test`, the diagnostics watcher, the step recorder, the viewport table.
 */

import { test as base } from '@playwright/test';

import { watchPage, type Diagnostics } from './diagnostics';
import { createWalkthrough, type Walkthrough } from './steps';
import { viewportByName, type ViewportName } from './viewports';

/** Options set per project in `playwright.config.ts`. */
export interface WalkthroughOptions {
  /** Which of the three declared viewports this project drives. */
  viewportName: ViewportName;
}

/** Fixtures every chapter can ask for. */
export interface WalkthroughFixtures {
  /** Console errors and failed requests recorded for this page. */
  diagnostics: Diagnostics;
  /** The step recorder: perform, photograph, audit. */
  walkthrough: Walkthrough;
}

/**
 * The test object for every walkthrough chapter.
 *
 * `diagnostics` is depended on by `walkthrough`, so the watcher is attached before the
 * first navigation even when a chapter never names it — an error logged during the initial
 * bundle load is exactly the kind that would otherwise be missed.
 */
export const test = base.extend<WalkthroughOptions & WalkthroughFixtures>({
  viewportName: ['desktop', { option: true }],

  diagnostics: async ({ page }, use) => {
    await use(watchPage(page));
  },

  walkthrough: async ({ page, diagnostics, viewportName }, use, testInfo) => {
    await use(
      createWalkthrough({
        page,
        diagnostics,
        viewport: viewportByName(viewportName),
        testInfo,
      }),
    );
  },
});

export { expect } from '@playwright/test';
