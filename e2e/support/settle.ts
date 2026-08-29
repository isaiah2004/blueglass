/**
 * Waiting for the layout to stop moving, before anything is clicked.
 *
 * Purpose
 *   `pnpm walkthrough` failed one run in two on `[tablet] the pill is hit-testable inside a
 *   line of scripture`. Playwright resolved the element — the test id was in the DOM — and
 *   then timed out at 15 s waiting for it to become "visible, enabled and stable". Nothing
 *   was wrong with the pill: the tablet project was starting into a cold Metro bundle with
 *   six workers competing for one machine, and Playwright's stability check (the same
 *   bounding box across two consecutive animation frames) cannot settle while the main
 *   thread is starved. Sibling tests in that same window took 33-37 s against 2-4 s once
 *   warm.
 *
 * Why this is not a retry, and not a longer action timeout
 *   `playwright.config.ts` sets `retries: 0` deliberately — "a retry locally would hide
 *   exactly the flake this harness must expose" — and raising `actionTimeout` would hide it
 *   the same way, everywhere, for every action. What this does instead is separate two
 *   different waits that had been sharing one 15 s budget: *the app becoming ready*, which
 *   on a cold bundle legitimately takes tens of seconds and belongs to the 90 s test
 *   timeout, and *the click*, which on a settled page is instantaneous and should still
 *   fail fast when the control is genuinely unreachable. After this wait, a 15 s click
 *   failure means what it says.
 *
 * What "settled" means
 *   The element has a non-zero box, and that box is identical across two consecutive
 *   animation frames — the same condition Playwright applies, asked with a budget that
 *   suits a cold start. It is still a condition, polled; never a sleep.
 *
 * Dependencies
 *   `@playwright/test` only.
 */

import { expect, type Page } from '@playwright/test';

/**
 * How long a control may take to stop moving.
 *
 * Generous, because it absorbs a cold Metro bundle under worker contention; bounded, because
 * a layout that never settles is a real defect and must still fail the run. Well inside the
 * 90 s test timeout, so the failure names this wait rather than the whole test.
 */
const SETTLE_TIMEOUT_MS = 60_000;

/**
 * Wait until a control has stopped moving.
 *
 * @param page The page to drive.
 * @param testId The control's test id.
 * @param what What the control is, in the words of the journey — used in the failure.
 * @throws {Error} If the element never reaches a stable, non-zero box.
 */
export async function waitForSettled(page: Page, testId: string, what: string): Promise<void> {
  const control = page.getByTestId(testId);
  await expect(
    control,
    `${what} (testID "${testId}") never appeared, so it cannot settle`,
  ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });

  await page
    .waitForFunction(
      (id: string) =>
        new Promise<boolean>((resolve) => {
          const node = document.querySelector(`[data-testid="${id}"]`);
          if (node === null) {
            resolve(false);
            return;
          }
          const first = node.getBoundingClientRect();
          requestAnimationFrame(() => {
            const second = node.getBoundingClientRect();
            resolve(
              second.width > 0 &&
                second.height > 0 &&
                first.x === second.x &&
                first.y === second.y &&
                first.width === second.width &&
                first.height === second.height,
            );
          });
        }),
      testId,
      { timeout: SETTLE_TIMEOUT_MS },
    )
    .catch((cause: unknown) => {
      throw new Error(
        `${what} (testID "${testId}") is on screen but its layout never settled within ` +
          `${String(SETTLE_TIMEOUT_MS / 1000)}s. Two consecutive frames never agreed on its ` +
          'box, which means something is still animating or re-laying-out under it.',
        { cause },
      );
    });
}
