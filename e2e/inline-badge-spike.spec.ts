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
 */

import { expect, test } from '@playwright/test';

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
    const counter = page.getByTestId('spike-tap-count');
    await expect(counter).toHaveText('taps: 0');

    await page.getByTestId('spike-tap-badge').click();

    // The whole point of the spike. If this fails, strategy B is not viable and the
    // decision in docs/architecture/spike-inline-badges.md has to be reopened.
    await expect(counter).toHaveText('taps: 1');
  });

  test('the pill keeps counting, so the first tap was not a fluke', async ({ page }) => {
    const badge = page.getByTestId('spike-tap-badge');
    await badge.click();
    await badge.click();
    await badge.click();

    await expect(page.getByTestId('spike-tap-count')).toHaveText('taps: 3');
  });

  test('tapping the surrounding text does not count as a badge tap', async ({ page }) => {
    // A pill that swallows taps meant for the verse would break the reading canvas
    // (pillar 1). The line is tapped at its far left, clear of the badge.
    const line = page.getByTestId('spike-tap-line');
    const box = await line.boundingBox();
    expect(box, 'the tap line must be laid out').not.toBeNull();
    if (box !== null) await page.mouse.click(box.x + 4, box.y + box.height / 2);

    await expect(page.getByTestId('spike-tap-count')).toHaveText('taps: 0');
  });
});
