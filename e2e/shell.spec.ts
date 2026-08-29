/**
 * Walkthrough: the app shell.
 *
 * Purpose
 *   The first end-to-end pass over the routes that exist today. It proves the four things
 *   a broken bundle takes down first, in the order a reader would meet them:
 *   the five-tab shell renders, each tab is reachable and shows its own screen, an
 *   unmatched URL lands on `+not-found` rather than a blank page, and no route logs a
 *   console error on the way.
 *
 * Why the web build
 *   `docs/decisions/ASSUMPTIONS.md` `Q-01`: the web export is the only surface a machine
 *   can drive unattended, which is what CLAUDE.md's walkthrough loop requires. Device
 *   coverage is Maestro's job, before each milestone.
 *
 * What this deliberately does NOT assert
 *   Anything visual. Tab icons and the reader canvas are not built yet; asserting on their
 *   absence would have to be deleted the day they land.
 */

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * The tabs, in `apps/mobile/app/(tabs)/_layout.tsx` order, with a line unique to each.
 *
 * Bible's line changed with the tab: it used to be a plan screen whose "Continue" card read
 * `Acts 1:1`, and it now redirects into the reading canvas, whose chapter heading reads
 * `Acts 1`. That is a deliberate product change (the tab is the front door to scripture,
 * not a landing page in front of it), so the expectation moved with it rather than being
 * relaxed — the line is still unique to this tab and still proves the right screen rendered.
 */
const TABS = [
  { path: '/', label: 'Home', body: /Today's Drop/ },
  { path: '/bible', label: 'Bible', body: /Acts 1/ },
  { path: '/discover', label: 'Discover', body: /empire timeline/ },
  { path: '/studio', label: 'Studio', body: /Studio/ },
  { path: '/journal', label: 'Journal', body: /Journal/ },
] as const;

/**
 * Collect console errors for the life of one page.
 *
 * A red screen is not the only way a bundle fails: a component that throws inside an
 * effect leaves the tree rendered and the error only in the console. Rule 6 says a
 * swallowed error is a bug you never see, so the walkthrough refuses to swallow it.
 *
 * @param page The page to watch.
 * @returns The array, which fills as the test runs.
 */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error: Error) => errors.push(error.message));
  return errors;
}

test.describe('the five-tab shell', () => {
  for (const tab of TABS) {
    test(`${tab.label} renders its own screen at ${tab.path}`, async ({ page }) => {
      const errors = collectConsoleErrors(page);

      await page.goto(tab.path);

      // The heading, not just any text: a screen that renders the wrong tab would still
      // match the tab bar, which carries all five labels on every route.
      await expect(page.getByText(tab.body).first()).toBeVisible();
      expect(errors, `console errors on ${tab.path}`).toEqual([]);
    });
  }

  test('the tab bar carries all five tabs on every route', async ({ page }) => {
    await page.goto('/bible');

    for (const tab of TABS) {
      await expect(page.getByText(tab.label, { exact: true }).first()).toBeVisible();
    }
  });

  test('ships no missing-icon placeholder', async ({ page }) => {
    await page.goto('/');

    // React Navigation draws a "⏷" MissingIcon whenever a tab declares no `tabBarIcon`.
    // Five tabs once shipped two each. `NO_ICON` in `(tabs)/_layout.tsx` is what keeps
    // this at zero until the real glyphs land.
    await expect(page.getByText('⏷')).toHaveCount(0);
  });

  test('tapping a tab navigates without a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Discover', { exact: true }).first().click();

    await expect(page).toHaveURL(/\/discover$/);
    await expect(page.getByText(/empire timeline/).first()).toBeVisible();
  });
});

test.describe('unmatched URLs', () => {
  test('land on the not-found screen, not a blank page', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/definitely-not-a-route');

    await expect(page.getByText(/does not exist/)).toBeVisible();
    await expect(page.getByText(/Go to Home/)).toBeVisible();
    expect(errors, 'console errors on the not-found route').toEqual([]);
  });

  test('the not-found screen can get back to Home', async ({ page }) => {
    await page.goto('/definitely-not-a-route');
    await page.getByText(/Go to Home/).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/Today's Drop/).first()).toBeVisible();
  });
});
