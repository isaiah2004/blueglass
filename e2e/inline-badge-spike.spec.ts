/**
 * Walkthrough: the inline-badge spike at `/spike/badges`.
 *
 * Purpose
 *   `apps/mobile/app/spike/badges.tsx` exists so a machine can check the one thing the
 *   badge design stands or falls on: an inline `<View>` inside a `<Text>` must still be
 *   hit-testable, or a badge can never open its sheet. The spike screen states that as its
 *   own acceptance criterion ("Tap the pill; the counter must advance"); this spec is what
 *   actually runs it.
 *
 * Scope and lifetime
 *   Web only — this measures the react-native-web path, not iOS or Android, where the
 *   baseline maths differs (`InlineBadge.geometry.ts`). Delete this file together with the
 *   spike route once the reader screen renders badges for real.
 *
 * Deliberately not asserted
 *   Pixel positions. The nudge is calibrated against a substituted font face until
 *   `expo-font` loads the real one (assumption `D-03`), so a screenshot comparison here
 *   would lock in a number that is known to be provisional.
 *
 * Why every tap waits for a settled layout first
 *   This spec failed one full `pnpm walkthrough` in two, always in the tablet project and
 *   always on `locator.click` timing out at 15 s while the element was already in the DOM.
 *   The pill was fine; the page had not stopped moving, because the project was starting
 *   into a cold Metro bundle with six workers on one machine. `support/settle.ts` explains
 *   why the answer is a separate, generously budgeted wait rather than a retry or a longer
 *   action timeout — the harness must keep exposing flake, not absorb it.
 */

import { expect, test } from '@playwright/test';

import { TAP_BADGE, TAP_COUNT, TAP_LINE, waitForSettledBadge } from './support/spike-ids';

test.describe('the inline-badge spike', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/spike/badges');
    await expect(page.getByText('Inline badge spike')).toBeVisible();
  });

  test('renders every strategy under comparison', async ({ page }) => {
    for (const heading of [
      'B · inline View (recommended)',
      'A · nested Text',
      'C · react-native-svg pill',
      'D · flex-wrap row of words',
      'Size ladder (strategy B)',
    ]) {
      await expect(page.getByText(heading)).toBeVisible();
    }
  });

  test('the pill is hit-testable inside a line of scripture', async ({ page }) => {
    const counter = page.getByTestId(TAP_COUNT);
    await expect(counter).toHaveText('taps: 0');
    await waitForSettledBadge(page);

    await page.getByTestId(TAP_BADGE).click();

    // The whole point of the spike. If this fails, strategy B is not viable and the
    // decision in docs/architecture/spike-inline-badges.md has to be reopened.
    await expect(counter).toHaveText('taps: 1');
  });

  test('the pill keeps counting, so the first tap was not a fluke', async ({ page }) => {
    await waitForSettledBadge(page);
    const badge = page.getByTestId(TAP_BADGE);
    await badge.click();
    await badge.click();
    await badge.click();

    await expect(page.getByTestId(TAP_COUNT)).toHaveText('taps: 3');
  });

  test('tapping the surrounding text does not count as a badge tap', async ({ page }) => {
    // A pill that swallows taps meant for the verse would break the reading canvas
    // (pillar 1). The line is tapped at its far left, clear of the badge.
    await waitForSettledBadge(page);
    const line = page.getByTestId(TAP_LINE);
    const box = await line.boundingBox();
    expect(box, 'the tap line must be laid out').not.toBeNull();
    if (box !== null) await page.mouse.click(box.x + 4, box.y + box.height / 2);

    await expect(page.getByTestId(TAP_COUNT)).toHaveText('taps: 0');
  });
});
