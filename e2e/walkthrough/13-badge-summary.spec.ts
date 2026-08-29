/**
 * Chapter 13 — the chapter-end summary, and following a cross-reference.
 *
 * The journey
 *   Scroll to the foot of Acts 16 and read the summary list `design-language.md` §5 asks
 *   for: every badge in the chapter, repeated as pill, teaser and chevron. Tap a row and
 *   check it opens the same badge the pill would have. Then open a cross-reference and
 *   follow it, which is the one badge whose whole purpose is to take the reader somewhere.
 *
 * Why the summary matters as much as the pills
 *   It is the path for a reader who does not want to tap mid-verse — the accessibility and
 *   the calm-reading route through the same content. If it drifts from the pills, the two
 *   halves of §5 say different things about the same chapter.
 *
 * Dependencies
 *   The walkthrough fixtures, the badge journeys, and the M1 test-id contract.
 */

import {
  BADGE_SUMMARY_IDS,
  BADGE_SURFACE_IDS,
  badgeSummaryRowId,
  type BadgeKindName,
} from '../support/badge-ids';
import {
  BADGE_CHAPTER_REFERENCE,
  badgeKindOf,
  badgeSurface,
  firstOfEachKind,
  inlineBadgeIds,
  openBadge,
  openBadgedChapter,
} from '../support/badge-journeys';
import { expect, test } from '../support/fixtures';

/** The reader route a followed cross-reference must land on. */
const READER_ROUTE = /\/read\/[a-z0-9-]+\/\d+/;

test.describe('13 · chapter badge summary', () => {
  test('the summary repeats every badge in the chapter', async ({ page, walkthrough }) => {
    let badgeIds: string[] = [];

    await walkthrough.step(`open ${BADGE_CHAPTER_REFERENCE}`, async () => {
      await openBadgedChapter(page);
      badgeIds = await inlineBadgeIds(page);
    });

    await walkthrough.step('scroll to the foot of the chapter', async () => {
      const summary = page.getByTestId(BADGE_SUMMARY_IDS.root);
      await summary.scrollIntoViewIfNeeded();
      await expect(
        summary,
        'design-language.md §5: at the bottom of a chapter, all badges in that chapter are ' +
          'repeated as a summary list. There is none.',
      ).toBeVisible();
    });

    await walkthrough.step('one row per badge, none missing and none invented', async () => {
      const rows = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid^="badge-summary-row-"]')).map(
          (element) =>
            (element.getAttribute('data-testid') ?? '').slice('badge-summary-row-'.length),
        ),
      );
      expect(
        rows.slice().sort(),
        'the summary and the pills disagree about what is in this chapter. Both are built ' +
          'from the same server response, so a difference is a rendering bug in one of them.',
      ).toEqual(badgeIds.slice().sort());
    });

    await walkthrough.step('the summary prints the sources it rests on', async () => {
      const sources = page.getByTestId(BADGE_SUMMARY_IDS.sources);
      await expect(
        sources,
        'AI-05: the teasers in this list are claims. Printed without their sources they are ' +
          'unattributed claims sitting under scripture.',
      ).toBeVisible();
      expect((await sources.innerText()).trim().length).toBeGreaterThan(0);
    });
  });

  test('a summary row opens the same badge its pill does', async ({ page, walkthrough }) => {
    let badgeId = '';

    await walkthrough.step('reach the summary', async () => {
      await openBadgedChapter(page);
      const first = (await inlineBadgeIds(page))[0];
      expect(first, 'no badges to summarise').toBeDefined();
      badgeId = first ?? '';
      await page.getByTestId(BADGE_SUMMARY_IDS.root).scrollIntoViewIfNeeded();
    });

    await walkthrough.step('tap the first row', async () => {
      const row = page.getByTestId(badgeSummaryRowId(badgeId));
      await expect(
        row,
        `the summary has no row for ${badgeId}, which has a pill in the text above`,
      ).toBeVisible();
      await row.click();
      await expect(
        badgeSurface(page, walkthrough.viewport),
        'a summary row with a chevron that opens nothing is a dead control',
      ).toBeVisible();
    });

    await walkthrough.step('it opened that badge, not another', async () => {
      const surface = badgeSurface(page, walkthrough.viewport);
      await expect(surface.getByTestId(BADGE_SURFACE_IDS.teaser)).toBeVisible();
      await expect(
        page.getByTestId(`badge-detail-${badgeId}`),
        `tapping the row for ${badgeId} opened a different badge`,
      ).toBeVisible();
    });
  });

  test('tapping a linked passage navigates to it', async ({ page, walkthrough }) => {
    let target = '';

    await walkthrough.step('open a cross-reference badge', async () => {
      await openBadgedChapter(page);
      const kinds: Map<BadgeKindName, string> = firstOfEachKind(await inlineBadgeIds(page));
      const badgeId = kinds.get('cross-ref');
      expect(badgeId, 'Acts 16 has cross-references but no cross-ref pill').toBeDefined();
      expect(badgeKindOf(badgeId ?? '')).toBe('cross-ref');
      await openBadge(page, badgeId ?? '', walkthrough.viewport);
    });

    await walkthrough.step('the sheet lists the passages it links to', async () => {
      const rows = page.locator('[data-testid^="cross-ref-row-"]');
      await expect(
        rows.first(),
        'a Cross-Ref sheet with no linked passages in it. The payload carries the target ' +
          'reference, its verse text and its vote count; none of it is rendered, so there ' +
          'is nothing to tap and nowhere to go.',
      ).toBeVisible();
      target = (await rows.first().innerText()).trim();
    });

    await walkthrough.step('tapping one goes there', async () => {
      const before = page.url();
      await page.locator('[data-testid^="cross-ref-row-"]').first().click();
      await expect(
        page,
        `tapping "${target}" did not navigate. Point-of-need intelligence (pillar 2) means ` +
          'a linked passage is reachable from where the reader already is.',
      ).toHaveURL(READER_ROUTE);
      expect(page.url(), 'the route did not change').not.toBe(before);
    });
  });
});
