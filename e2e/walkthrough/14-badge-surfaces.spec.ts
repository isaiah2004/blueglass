/**
 * Chapter 14 — where a badge opens, and what happens when the API goes away mid-session.
 *
 * The journey
 *   Tap a badge at each width and measure the surface it opened into: below 600 dp it must
 *   be a half sheet with scripture still visible above it; at and above 600 dp it must fill
 *   the context rail beside the text and never cover a word. Then, with a chapter already
 *   read, cut the API and step to the next chapter — the case a reader on a train hits, and
 *   the one an offline-first story is easy to get wrong.
 *
 * Why "half" is measured rather than asserted by test id
 *   `design-language.md` §4 gives the sheet the bottom half specifically so the scripture
 *   above it stays visible — "that visible scripture is the whole point of the
 *   interaction". A sheet that grew to full height would still carry its test id. Only the
 *   geometry catches it, and pillar 1 is exactly a claim about geometry.
 *
 * Dependencies
 *   The walkthrough fixtures, the badge journeys, and the outage helper.
 */

import { BADGE_SURFACE_IDS, INLINE_BADGE_PREFIX } from '../support/badge-ids';
import {
  BADGE_CHAPTER_REFERENCE,
  expectedBadgeHome,
  inlineBadgeIds,
  openBadge,
  openBadgedChapter,
} from '../support/badge-journeys';
import { cutTheApi, type ApiOutage } from '../support/api-outage';
import { expect, test } from '../support/fixtures';
import { READER_IDS, verseId } from '../support/test-ids';

/** The most of the viewport a phone badge sheet may cover, per `design-language.md` §4. */
const MAX_SHEET_HEIGHT_SHARE = 0.7;

/** The least of the rail's own height a badge should fill before it looks unfinished. */
const MIN_RAIL_FILL_SHARE = 0.05;

test.describe('14 · badge surfaces', () => {
  test('a badge opens into the home its width calls for', async ({ page, walkthrough }) => {
    const home = expectedBadgeHome(walkthrough.viewport);

    await walkthrough.step(`open a badge at ${walkthrough.viewport.name} width`, async () => {
      await openBadgedChapter(page);
      const first = (await inlineBadgeIds(page))[0];
      expect(first, `no pills in ${BADGE_CHAPTER_REFERENCE}`).toBeDefined();
      await openBadge(page, first ?? '', walkthrough.viewport);
    });

    await walkthrough.step(`it opened as a ${home}, and only as a ${home}`, async () => {
      const other = home === 'rail' ? BADGE_SURFACE_IDS.sheet : BADGE_SURFACE_IDS.rail;
      await expect(
        page.getByTestId(other),
        `Q-006: at ${String(walkthrough.viewport.width)} px the badge belongs in the ${home}. ` +
          'Both surfaces showing one badge means the phone and the desktop paths are live ' +
          'at once and will drift.',
      ).toHaveCount(0);
    });

    await walkthrough.step('scripture is still on screen beside or above it', async () => {
      const geometry = await page.evaluate(
        (ids: { surface: string; canvas: string }) => {
          const surface = document.querySelector(`[data-testid="${ids.surface}"]`);
          const canvas = document.querySelector(`[data-testid="${ids.canvas}"]`);
          if (surface === null || canvas === null) return null;
          const s = surface.getBoundingClientRect();
          const c = canvas.getBoundingClientRect();
          const overlapWidth = Math.max(0, Math.min(s.right, c.right) - Math.max(s.left, c.left));
          const overlapHeight = Math.max(0, Math.min(s.bottom, c.bottom) - Math.max(s.top, c.top));
          return {
            surfaceHeight: s.height,
            viewportHeight: window.innerHeight,
            covered: (overlapWidth * overlapHeight) / Math.max(1, c.width * c.height),
          };
        },
        {
          surface: home === 'rail' ? BADGE_SURFACE_IDS.rail : BADGE_SURFACE_IDS.sheet,
          canvas: READER_IDS.canvas,
        },
      );

      expect(geometry, 'the badge surface or the canvas is not in the document').not.toBeNull();
      if (geometry === null) return;

      if (home === 'sheet') {
        const share = geometry.surfaceHeight / geometry.viewportHeight;
        expect(
          share,
          `design-language.md §4: the badge sheet covers the bottom half and leaves the ` +
            `scripture above it visible. This one covers ${(share * 100).toFixed(0)}% of ` +
            'the viewport, which makes it a full-screen modal in all but name.',
        ).toBeLessThan(MAX_SHEET_HEIGHT_SHARE);
      } else {
        expect(
          geometry.covered,
          'pillar 1: nothing floats over scripture. The rail sits beside the canvas; ' +
            'overlapping it means the badge is covering words.',
        ).toBeLessThan(MIN_RAIL_FILL_SHARE);
      }
    });
  });

  test('badges survive the API going away mid-session', async ({
    page,
    walkthrough,
    diagnostics,
  }) => {
    // The outage is the point of this test, so the browser's own noise about a refused
    // connection is expected evidence rather than a finding. Chapter 10 makes the same
    // allowance for the same reason; what is still asserted is what the app does about it.
    diagnostics.allowRequests(/.*/);
    diagnostics.allowConsole(/Failed to fetch|NetworkError|net::ERR_|ERR_CONNECTION_REFUSED/i);

    await walkthrough.step(`read ${BADGE_CHAPTER_REFERENCE} with the API up`, async () => {
      await openBadgedChapter(page);
      expect((await inlineBadgeIds(page)).length).toBeGreaterThan(0);
    });

    let outage: ApiOutage | undefined;

    await walkthrough.step('cut the API and step to the next chapter', async () => {
      outage = await cutTheApi(page);
      await page.getByTestId(READER_IDS.nextChapter).click();
      await page.waitForTimeout(2_000);
      expect(
        outage?.attempts() ?? 0,
        'the reader asked the API for nothing after the chapter changed, so nothing below ' +
          'this can be concluded about how it behaves offline.',
      ).toBeGreaterThan(0);
    });

    await walkthrough.step('no pill claims data the app does not have', async () => {
      const badgeIds = await inlineBadgeIds(page);
      expect(
        badgeIds,
        'the reader is showing badges for a chapter whose enrichment request failed. ' +
          'A pill that opens onto nothing is worse than no pill.',
      ).toEqual([]);
      await expect(
        page.getByTestId(BADGE_SURFACE_IDS.sheet),
        'a badge surface is open with no badge behind it',
      ).toHaveCount(0);
    });

    await walkthrough.step('the reader itself still says something honest', async () => {
      const canvasCount = await page.getByTestId(verseId(1)).count();
      const errorCount = await page
        .locator('[data-testid^="reader-offline"], [data-testid^="reader-error"]')
        .count();
      expect(
        canvasCount + errorCount,
        'with the API down the reader shows neither scripture nor an error — a blank ' +
          'canvas, which is the one outcome chapter 10 rules out.',
      ).toBeGreaterThan(0);
    });

    await walkthrough.step('restoring the API brings the pills back', async () => {
      await outage?.restore();
      await page.reload();
      await page.goto('/read/acts/16');
      await expect(page.getByTestId(verseId(1))).toBeVisible({ timeout: 30_000 });
      await expect(
        page.locator(`[data-testid^="${INLINE_BADGE_PREFIX}"]`).first(),
        'enrichment never recovered after the API came back, so a single failed request ' +
          'costs the reader badges for the rest of the session.',
      ).toBeAttached({ timeout: 30_000 });
    });
  });
});
