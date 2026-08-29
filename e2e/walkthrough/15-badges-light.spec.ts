/**
 * Chapter 15 — the badge system in light mode.
 *
 * The journey
 *   Toggle to light, open Acts 16, look at the pills, open a badge, and open the
 *   chapter-end summary. Every step photographs itself, so the evidence folder holds a
 *   light-theme frame of every M2 surface beside the dark ones.
 *
 * Why M2 needs its own theme chapter
 *   `D-01` is one of the 26 overrides: light mode actually ships and every component is
 *   verified in both. Chapter 7 verifies the canvas — it predates the badges. A badge is
 *   the hardest thing in the app to theme, because each of the five kinds carries its own
 *   hue and each hue has to hold its tint, its 10% fill and its 35% border against a light
 *   card as well as a dark one. `C-3` already caught one palette that failed its own
 *   accessibility bar; a tinted word on a light canvas is exactly that class of bug.
 *
 * What is asserted, and what is only photographed
 *   Measured: the canvas really inverted, the pill is painted rather than transparent, and
 *   the standing audit (which every step runs) still passes. Judged by eye from the
 *   screenshots: whether the hues are attractive in light. A harness should not pretend to
 *   the second.
 *
 * Dependencies
 *   The walkthrough fixtures, the badge journeys, and the theme probes.
 */

import { BADGE_SUMMARY_IDS, INLINE_BADGE_PREFIX } from '../support/badge-ids';
import {
  BADGE_CHAPTER_REFERENCE,
  closeBadge,
  inlineBadgeIds,
  openBadge,
  openBadgedChapter,
} from '../support/badge-journeys';
import { expect, test } from '../support/fixtures';
import { tap } from '../support/journeys';
import { effectiveBackgroundColor, lightnessOf } from '../support/probes-theme';
import { READER_IDS, SHELL_IDS } from '../support/test-ids';

/** Above this the canvas is a light theme rather than a slightly paler dark one. */
const MIN_LIGHT_CANVAS_LIGHTNESS = 0.6;

/** A pill painted at pure transparency is a pill the reader cannot see. */
const TRANSPARENT = /rgba\(0,\s*0,\s*0,\s*0\)|transparent/;

test.describe('15 · badges in light mode', () => {
  test('every badge surface survives the light theme', async ({ page, walkthrough }) => {
    let badgeId = '';

    await walkthrough.step(`open ${BADGE_CHAPTER_REFERENCE}`, async () => {
      await openBadgedChapter(page);
      const first = (await inlineBadgeIds(page))[0];
      expect(first, 'no pills to look at').toBeDefined();
      badgeId = first ?? '';
    });

    await walkthrough.step('switch to light', async () => {
      await tap(page, SHELL_IDS.themeToggle, 'the theme toggle');
      const canvas = await effectiveBackgroundColor(page, READER_IDS.screen);
      expect(
        lightnessOf(canvas),
        `D-01: light mode ships. After the toggle the reading canvas is still ${canvas}, ` +
          'which is not a light surface.',
      ).toBeGreaterThan(MIN_LIGHT_CANVAS_LIGHTNESS);
    });

    await walkthrough.step('the pills are still painted, and still inside the text', async () => {
      const ids = await inlineBadgeIds(page);
      expect(
        ids.length,
        'the pills disappeared when the theme changed, so the badge layer is reading a ' +
          'palette that only exists in dark.',
      ).toBeGreaterThan(0);

      const unpainted = await page.evaluate((prefix: string) => {
        const problems: string[] = [];
        for (const pill of document.querySelectorAll(`[data-testid^="${prefix}"]`)) {
          const style = getComputedStyle(pill);
          problems.push(
            `${pill.getAttribute('data-testid') ?? '?'}|${style.backgroundColor}|${style.borderTopColor}`,
          );
        }
        return problems;
      }, INLINE_BADGE_PREFIX);

      const invisible = unpainted.filter((row) => {
        const [, background, border] = row.split('|');
        return TRANSPARENT.test(background ?? '') && TRANSPARENT.test(border ?? '');
      });
      expect(
        invisible,
        'design-language.md §5 gives the pill a 10% fill and a 35% border in its hue. ' +
          'These pills have neither in light mode, so the mark is invisible.',
      ).toEqual([]);
    });

    await walkthrough.step('a badge opens and reads in light', async () => {
      const surface = await openBadge(page, badgeId, walkthrough.viewport);
      const text = (await surface.innerText()).trim();
      expect(text.length, 'the badge surface opened empty in light mode').toBeGreaterThan(0);
    });

    await walkthrough.step('close it again', async () => {
      await closeBadge(page, walkthrough.viewport);
    });

    await walkthrough.step('the chapter-end summary reads in light', async () => {
      const summary = page.getByTestId(BADGE_SUMMARY_IDS.root);
      await summary.scrollIntoViewIfNeeded();
      await expect(summary).toBeVisible();
    });

    await walkthrough.step('switch back to dark', async () => {
      await tap(page, SHELL_IDS.themeToggle, 'the theme toggle');
      const canvas = await effectiveBackgroundColor(page, READER_IDS.screen);
      expect(
        lightnessOf(canvas),
        'the toggle only travels one way, so a reader who tries light is stuck in it.',
      ).toBeLessThan(MIN_LIGHT_CANVAS_LIGHTNESS);
    });
  });
});
