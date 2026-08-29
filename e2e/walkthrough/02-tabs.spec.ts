/**
 * Chapter 2 · The five tabs.
 *
 * A reader's first act after launch is to look around. This chapter taps through Home,
 * Bible, Discover, Studio and Journal in order — by tapping the control, never by typing a
 * URL, because a route that only works when addressed directly is not a tab.
 *
 * Each stop is photographed and put through the standing audit, which is what makes this
 * chapter worth its runtime: the tab content is somebody else's to build, but "no sideways
 * scroll, no clipped label, no 32 px target, no console error" is true of all five or the
 * shell is wrong.
 *
 * Routes: `/`, `/bible`, `/discover`, `/studio`, `/journal`
 */

import { expect, test } from '../support/fixtures';
import { launchApp, openTab } from '../support/journeys';
import { SCREEN_IDS, SHELL_IDS, TAB_IDS } from '../support/test-ids';

/** The tabs in `(tabs)/_layout.tsx` order, with the route each must land on. */
const TOUR = [
  { tab: 'home', url: /\/$/, screen: SCREEN_IDS.home },
  { tab: 'bible', url: /\/(bible|read)/, screen: SCREEN_IDS.bible },
  { tab: 'discover', url: /\/discover$/, screen: SCREEN_IDS.discover },
  { tab: 'studio', url: /\/studio$/, screen: SCREEN_IDS.studio },
  { tab: 'journal', url: /\/journal$/, screen: SCREEN_IDS.journal },
] as const;

test.describe('chapter 2 · the five tabs', () => {
  test('every tab is reachable by tapping, and each is sound', async ({ page, walkthrough }) => {
    await walkthrough.step('launch', async () => {
      await launchApp(page);
    });

    for (const stop of TOUR) {
      await walkthrough.step(`tap the ${stop.tab} tab`, async () => {
        await openTab(page, stop.tab, stop.url);

        // Catches: a tab that navigates but renders nothing, and a tab that swallows the
        // shell on the way — the bar must survive every route, or the reader is stranded.
        await expect(
          page.getByTestId(SHELL_IDS.tabBar),
          `the tab bar disappeared on the ${stop.tab} route`,
        ).toBeVisible();
        await expect(
          page.getByTestId(TAB_IDS[stop.tab]),
          `the ${stop.tab} tab control vanished from its own route`,
        ).toBeVisible();

        // Catches: a tab that changes the URL but renders the previous screen, which a
        // URL-only assertion cannot see and a screenshot review reads as "still loading".
        await expect(
          page.getByTestId(stop.screen),
          `the ${stop.tab} route did not render its own screen (testID "${stop.screen}")`,
        ).toBeVisible();
      });
    }
  });

  test('the shell survives a full round trip', async ({ page, walkthrough }) => {
    await walkthrough.step('walk the tabs there and back', async () => {
      await launchApp(page);
      for (const stop of TOUR) await openTab(page, stop.tab, stop.url);
      for (const stop of [...TOUR].reverse()) await openTab(page, stop.tab, stop.url);

      // Catches: state that accumulates across navigations — a mounted screen that is never
      // unmounted, a listener that stacks, a modal left open behind the next screen. Ten
      // navigations is enough for any of those to show up as a duplicated tab bar.
      await expect(
        page.getByTestId(SHELL_IDS.tabBar),
        'more than one tab bar is mounted after ten navigations',
      ).toHaveCount(1);
    });
  });
});
