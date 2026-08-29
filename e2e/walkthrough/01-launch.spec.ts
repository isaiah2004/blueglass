/**
 * Chapter 1 · Launch.
 *
 * The first thing a reader does, at all three widths: open the app and look at it. Nothing
 * later in the walkthrough means anything if this chapter fails, so it asserts the four
 * facts every other chapter takes for granted — the bundle mounted, the shell drew its
 * navigation, the browser tab names the app, and the canvas is actually painted.
 *
 * Route: `/`
 */

import { expect, test } from '../support/fixtures';
import { launchApp } from '../support/journeys';
import { documentBackgroundColor, lightnessOf } from '../support/probes-theme';
import { SCREEN_IDS, SHELL_IDS, TAB_IDS } from '../support/test-ids';

test.describe('chapter 1 · launch', () => {
  test('the app boots into a painted, navigable shell', async ({ page, walkthrough }) => {
    await walkthrough.step('cold launch at /', async () => {
      await launchApp(page);

      // Catches: a bundle that mounts an empty root. `#root` gains a child either way, so
      // a smoke test that only waited for load would pass on a blank screen; requiring the
      // tab bar means the shell composed, not merely that React started.
      await expect(
        page.getByTestId(SHELL_IDS.tabBar),
        `no navigation surface (testID "${SHELL_IDS.tabBar}") after launch`,
      ).toBeVisible();
    });

    await walkthrough.step('every tab is reachable from the first screen', async () => {
      for (const [name, testId] of Object.entries(TAB_IDS)) {
        // Catches: a tab that exists as a route but never renders a control, which strands
        // a reader on whichever screen they landed on. All five are M1 scope.
        await expect(
          page.getByTestId(testId),
          `the ${name} tab control (testID "${testId}") is missing from the shell`,
        ).toBeVisible();
      }
    });

    await walkthrough.step('the browser tab names the app', async () => {
      // Catches: a web export shipping the framework's default document title, which is
      // what a reader sees in their tab strip, their history and every bookmark they make.
      await expect(page).toHaveTitle(/Atlas Bible/i);
    });

    await walkthrough.step('the canvas is painted dark by default', async () => {
      // Polled rather than read once. The document's background is painted by a style the
      // shell applies on mount, so reading it on the very first frame after navigation is a
      // race — and a walkthrough that fails one viewport in three teaches everyone to
      // re-run it rather than read it.
      await expect
        .poll(async () => documentBackgroundColor(page), {
          message:
            'nothing in the document ever painted a background, so the browser is showing its own white behind the app',
        })
        .not.toBe('transparent');

      // Catches: the canvas token never reaching the document. On web that shows as a white
      // page behind every screen — the flash-of-white bug — and silently breaks D-01's
      // "dark cinematic by default" before light mode has even been built.
      const background = await documentBackgroundColor(page);
      expect(
        lightnessOf(background),
        `the default canvas is "${background}", which is not a dark surface (D-01)`,
      ).toBeLessThan(0.5);
    });
  });

  test('a deep link into an unknown route degrades honestly', async ({ page, walkthrough }) => {
    await walkthrough.step('open a route that does not exist', async () => {
      await page.goto('/no-such-route-in-this-app');

      // Catches: an unmatched URL rendering nothing at all. A reader who mistypes, or
      // follows an old share link, must get a way back rather than a blank canvas.
      await expect(
        page.getByTestId(SCREEN_IDS.notFound),
        `an unmatched URL rendered no not-found screen (testID "${SCREEN_IDS.notFound}")`,
      ).toBeVisible();
    });
  });
});
