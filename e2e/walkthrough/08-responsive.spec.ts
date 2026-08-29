/**
 * Chapter 8 · Across the breakpoints.
 *
 * `Q-006` reinstated full phone / tablet / desktop parity, which put port-map risk #5 — no
 * split pane in React Native — back on the table. The other chapters each run at one fixed
 * width; this one resizes a live page across all three regimes without reloading, because
 * that is the case the prototype's Flutter layout handled for free and a React layout does
 * not: a window drag, a tablet rotation, a phone unfolding.
 *
 * It runs once, in the desktop project. Running it three times would mean resizing a
 * 375 px window up to 1280 px three times over and asserting exactly the same things.
 *
 * Route: `/read/acts/1`
 */

import { expect, test } from '../support/fixtures';
import { auditPage } from '../support/audits';
import { openReader } from '../support/journeys';
import { READER_IDS } from '../support/test-ids';
import { RAIL_BREAKPOINT_PX, SPLIT_BREAKPOINT_PX, VIEWPORTS } from '../support/viewports';

test.describe('chapter 8 · across the breakpoints', () => {
  // The chapter resizes the page itself, so the viewport a project starts at is irrelevant.
  test.skip(
    ({ viewportName }) => viewportName !== 'desktop',
    'this chapter drives all three widths itself; running it per project would only repeat it',
  );

  test('the reader survives a live resize through every regime', async ({ page, walkthrough }) => {
    await walkthrough.step('open the reader at desktop width', async () => {
      await openReader(page);
    });

    for (const viewport of VIEWPORTS) {
      await walkthrough.step(
        `resize to ${viewport.name} (${String(viewport.width)}px)`,
        async () => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });

          // Catches: a layout that only computes its breakpoint on mount. Resizing a live
          // page is the case a `useWindowDimensions` hook handles and a module-level
          // `Dimensions.get('window')` constant does not — and the constant is the idiom a
          // Flutter port reaches for first.
          await expect(
            page.getByTestId(READER_IDS.screen),
            `the reader unmounted when resized to ${String(viewport.width)}px`,
          ).toBeVisible();
          await auditPage(page, `live resize to ${viewport.name} — ${viewport.regime}`);
        },
      );
    }
  });

  test('the rail and the split pane appear only above their breakpoints', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step('below 600 dp there is no rail', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await openReader(page);

      // Catches: a rail rendered at phone width. It is the most likely cause of a sideways
      // scroll on a 375 px screen, and it steals room from the reading canvas.
      await expect(
        page.getByTestId(READER_IDS.contextRail),
        `the context rail is showing below the ${String(RAIL_BREAKPOINT_PX)} dp breakpoint`,
      ).toBeHidden();
    });

    await walkthrough.step('at 768 dp the rail appears, the split does not', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });

      // Catches: the third of the prototype's UI the port map had proposed deleting, going
      // missing. Q-006 explicitly reinstated it, so an absent rail here is a scope failure
      // rather than a layout one.
      await expect(
        page.getByTestId(READER_IDS.contextRail),
        `the context rail is missing at 768 dp, above the ${String(RAIL_BREAKPOINT_PX)} dp breakpoint`,
      ).toBeVisible();
      await expect(
        page.getByTestId(READER_IDS.splitPane),
        `the two-pane split appeared below the ${String(SPLIT_BREAKPOINT_PX)} dp breakpoint`,
      ).toBeHidden();
    });

    await walkthrough.step('at 1280 dp the reader splits in two', async () => {
      await page.setViewportSize({ width: 1280, height: 800 });

      await expect(
        page.getByTestId(READER_IDS.splitPane),
        `the two-pane split is missing at 1280 dp, above the ${String(SPLIT_BREAKPOINT_PX)} dp breakpoint`,
      ).toBeVisible();
    });
  });

  test('the rail can be resized by dragging its handle', async ({ page, walkthrough }) => {
    await walkthrough.step('drag the rail divider to the left', async () => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await openReader(page);

      const rail = page.getByTestId(READER_IDS.contextRail);
      const handle = page.getByTestId(READER_IDS.railHandle);
      const before = (await rail.boundingBox())?.width ?? 0;
      const grip = await handle.boundingBox();
      expect(grip, 'the rail handle is not laid out, so it cannot be dragged').not.toBeNull();
      if (grip === null) return;

      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      await page.mouse.move(grip.x + grip.width / 2 - 120, grip.y + grip.height / 2, { steps: 12 });
      await page.mouse.up();

      // Catches: the drift bug the prototype fixed and documented — a divider driven by
      // accumulated deltas instead of the absolute pointer position slides out from under
      // the cursor after the first clamp (`resizable_split.dart:44-50`). It also catches a
      // handle that renders but was never wired to a gesture at all.
      const after = (await rail.boundingBox())?.width ?? 0;
      expect(
        Math.abs(after - before),
        `dragging the divider 120px changed the rail width from ${String(Math.round(before))}px to ${String(Math.round(after))}px`,
      ).toBeGreaterThan(40);
    });
  });
});
