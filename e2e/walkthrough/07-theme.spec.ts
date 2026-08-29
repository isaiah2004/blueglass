/**
 * Chapter 7 · Light and dark.
 *
 * `D-01` is one of the 26 overrides: dark is the default, but **light mode actually ships**,
 * and every component is verified in both. Verified is the operative word — a theme that
 * exists in the token file but was never looked at ships with white text on a white canvas
 * somewhere, and the somewhere is always a screen nobody demoed.
 *
 * This chapter toggles on the reading canvas, because that is where a theme failure costs
 * the most, and it asserts on measured colour rather than on a screenshot: it checks that
 * the canvas genuinely inverted, that scripture inverted with it, and that the full standing
 * audit still passes in the other theme.
 *
 * Route: `/read/acts/1`
 */

import { expect, test } from '../support/fixtures';
import { openReader, openTab, tap } from '../support/journeys';
import { effectiveBackgroundColor, lightnessOf, textColorInside } from '../support/probes-theme';
import { READER_IDS, SHELL_IDS, verseId } from '../support/test-ids';

/**
 * The canvas is measured behind the reader, not on `<html>`.
 *
 * React Native Web paints the canvas on a view inside the root, and every view above it is
 * transparent, so reading `<html>`'s background reports `transparent` on a perfectly
 * correct reader. `effectiveBackgroundColor` walks up from the reader to the first surface
 * that actually paints, which is the colour a reader is looking at.
 */
const readerCanvas = async (
  page: Parameters<typeof effectiveBackgroundColor>[0],
): Promise<string> => effectiveBackgroundColor(page, READER_IDS.screen);

/** How far apart two themes' canvases must be to count as different themes at all. */
const MIN_LIGHTNESS_GAP = 0.3;

/**
 * Scripture's ink is measured on the text node, not on the row that contains it.
 *
 * A verse row is a pressable `View` that sets no colour of its own, so reading its
 * computed `color` reports the browser's inherited `rgb(0, 0, 0)` however correct the
 * theme is. This chapter spent its whole existence failing on step 1 for that reason, and
 * steps 2 to 4 — the ones that actually verify light mode, which is what `D-01` promised —
 * had therefore never run once.
 */
const scriptureInk = async (
  page: Parameters<typeof textColorInside>[0],
): Promise<string> => textColorInside(page, verseId(1));

test.describe('chapter 7 · light and dark', () => {
  test('the theme toggle genuinely inverts the reading canvas', async ({ page, walkthrough }) => {
    let darkCanvas = '';
    let darkInk = '';

    await walkthrough.step('open the reader in the default dark theme', async () => {
      await openReader(page);
      darkCanvas = await readerCanvas(page);
      darkInk = await scriptureInk(page);

      expect(
        lightnessOf(darkCanvas),
        `the default canvas "${darkCanvas}" is not dark`,
      ).toBeLessThan(0.5);
      expect(
        lightnessOf(darkInk),
        `scripture is painted "${darkInk}" on a dark canvas, which cannot be read`,
      ).toBeGreaterThan(0.5);
    });

    await walkthrough.step('switch to light', async () => {
      await tap(page, SHELL_IDS.themeToggle, 'the theme toggle');

      const lightCanvas = await readerCanvas(page);
      // Catches: a toggle wired to state that no style consumes — the control flips, the
      // page does not, and light mode is a preference that does nothing. Comparing measured
      // lightness rather than inequality also catches a "light" theme that is darker than
      // the dark one, which token swaps get wrong more often than they should.
      expect(
        lightnessOf(lightCanvas) - lightnessOf(darkCanvas),
        `the canvas went from "${darkCanvas}" to "${lightCanvas}", which is not a change of theme`,
      ).toBeGreaterThan(MIN_LIGHTNESS_GAP);
    });

    await walkthrough.step('scripture is still legible in light', async () => {
      const lightInk = await scriptureInk(page);

      // Catches: the exact failure D-01 exists to prevent — an ink token that did not swap
      // with the canvas, leaving near-white scripture on a near-white page. The legibility
      // probe cannot see this, because the text is present and correctly sized.
      expect(
        lightnessOf(lightInk),
        `scripture is painted "${lightInk}" in light mode, which is not readable ink`,
      ).toBeLessThan(0.5);
    });

    await walkthrough.step('the light theme survives navigation', async () => {
      await openTab(page, 'home', /\/$/);

      // Catches: theme held in a component's local state rather than in a store, so it
      // resets on every navigation. A reader who chose light gets it back on one screen.
      const afterNavigation = await effectiveBackgroundColor(page, SHELL_IDS.tabBar);
      expect(
        lightnessOf(afterNavigation),
        `the theme reverted to "${afterNavigation}" after navigating to Home`,
      ).toBeGreaterThan(lightnessOf(darkCanvas) + MIN_LIGHTNESS_GAP);
    });

    await walkthrough.step('switching back restores dark', async () => {
      await tap(page, SHELL_IDS.themeToggle, 'the theme toggle');

      // Measured on the tab bar, not on the reader: the previous step deliberately
      // navigated to Home, so the reading canvas is no longer on screen and asking for its
      // background reports "transparent" however correct the theme is. The surface under
      // test is whichever one the reader is looking at.
      //
      // Catches: a one-way toggle. Half of "verified in both themes" is being able to
      // get back, and a toggle that only travels one way is a bug a demo never finds.
      const restored = await effectiveBackgroundColor(page, SHELL_IDS.tabBar);
      expect(
        lightnessOf(restored),
        `switching back left the chrome at "${restored}" rather than a dark surface`,
      ).toBeLessThan(0.5);
    });
  });
});
