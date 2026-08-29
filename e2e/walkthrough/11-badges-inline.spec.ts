/**
 * Chapter 11 — the pills, inside the line.
 *
 * The journey
 *   Open Acts 16, the chapter milestone M2 is specified against, and look at what the
 *   reader sees before tapping anything: are there pills, are they inside the verse rather
 *   than beside it, does the line rhythm survive them, and is scripture still the thing the
 *   eye lands on. Then open a chapter measured to have none, because that is the state most
 *   of the canon is in and a badge system that only degrades gracefully in theory is not
 *   one that ships.
 *
 * What it can catch that a unit test cannot
 *   `A-1` settled that an inline badge is a `<View>` inside the verse's `<Text>`. That is a
 *   claim about layout, and layout is only true on a real line box: a pill that is a block
 *   element, or one taller than the leading, wraps its verse wrongly and no component test
 *   sees it. Pillar 1 — the pristine reading canvas — is likewise a claim about how much of
 *   the screen is not scripture, which is measurable here and nowhere else.
 *
 * Dependencies
 *   The walkthrough fixtures, the badge journeys, and the M1 test-id contract.
 */

import { INLINE_BADGE_PREFIX } from '../support/badge-ids';
import {
  BADGE_CHAPTER_REFERENCE,
  BADGELESS_CHAPTER_PATH,
  BADGELESS_CHAPTER_REFERENCE,
  badgeKindOf,
  firstOfEachKind,
  inlineBadgeIds,
  MIN_BADGES_IN_ACTS_16,
  openBadgedChapter,
} from '../support/badge-journeys';
import { expect, test } from '../support/fixtures';
import { openReader } from '../support/journeys';
import { READER_IDS, verseId } from '../support/test-ids';

/**
 * How much of the canvas may be badge, before the canvas stops being a reading canvas.
 *
 * Pillar 1 is a design promise, so it needs a number or it is unenforceable. 6% of the
 * painted reader area is roughly one pill per two verses at reading size — noticeably more
 * than the mockups show, and far less than a canvas a reader would call busy. It exists to
 * catch a regression that doubles the badge count or the pill size, not to grade the
 * current design.
 */
const MAX_BADGE_AREA_SHARE = 0.06;

test.describe('11 · badges inline', () => {
  test('Acts 16 carries pills for all five badge kinds', async ({ page, walkthrough }) => {
    let badgeIds: string[] = [];

    await walkthrough.step(`open ${BADGE_CHAPTER_REFERENCE}`, async () => {
      await openBadgedChapter(page);
      badgeIds = await inlineBadgeIds(page);
      expect(
        badgeIds.length,
        `${BADGE_CHAPTER_REFERENCE} rendered ${String(badgeIds.length)} pills. ` +
          'This is the chapter the milestone is specified against; it is enriched from ' +
          'five separate datasets and should carry at least one pill from each.',
      ).toBeGreaterThanOrEqual(MIN_BADGES_IN_ACTS_16);
    });

    await walkthrough.step('every pill names a badge kind the product committed to', async () => {
      badgeIds = await inlineBadgeIds(page);
      const unknown = badgeIds.filter((id) => badgeKindOf(id) === undefined);
      expect(
        unknown,
        `these pills name a kind outside the five of P-04: ${unknown.join(', ')}`,
      ).toEqual([]);

      const kinds = firstOfEachKind(badgeIds);
      expect(
        [...kinds.keys()].sort(),
        'P-04 commits to five badges. Acts 16 has data for all five, so a kind missing ' +
          'here is a kind the reader can never reach.',
      ).toEqual(['3d-city', 'cross-ref', 'history', 'root', 'route']);
    });

    await walkthrough.step('each pill sits inside its verse, not beside it', async () => {
      const strays = await page.evaluate((prefix: string) => {
        const problems: string[] = [];
        for (const pill of document.querySelectorAll(`[data-testid^="${prefix}"]`)) {
          const verse = pill.closest('[data-testid^="verse-row-"]');
          if (verse === null) {
            problems.push(`${pill.getAttribute('data-testid') ?? '?'} is not inside any verse`);
          }
        }
        return problems;
      }, INLINE_BADGE_PREFIX);
      expect(
        strays,
        'A-1: an inline badge is a View inside the verse Text. A pill outside its verse ' +
          'is a badge the reader cannot associate with a word.',
      ).toEqual([]);
    });
  });

  test('the pills do not break the line rhythm', async ({ page, walkthrough }) => {
    await walkthrough.step(`open ${BADGE_CHAPTER_REFERENCE}`, async () => {
      await openBadgedChapter(page);
    });

    await walkthrough.step('no pill is taller than the line it sits on', async () => {
      const oversized = await page.evaluate((prefix: string) => {
        const problems: string[] = [];
        for (const pill of document.querySelectorAll(`[data-testid^="${prefix}"]`)) {
          const verse = pill.closest('[data-testid^="verse-row-"]');
          if (verse === null) continue;
          const leading = Number.parseFloat(getComputedStyle(verse).lineHeight);
          const height = pill.getBoundingClientRect().height;
          if (Number.isFinite(leading) && leading > 0 && height > leading) {
            problems.push(
              `${pill.getAttribute('data-testid') ?? '?'} is ${height.toFixed(1)}px tall ` +
                `in a ${leading.toFixed(1)}px line`,
            );
          }
        }
        return problems;
      }, INLINE_BADGE_PREFIX);
      expect(
        oversized,
        'design-language.md §5: the badge must not disturb the scripture line rhythm. ' +
          'A pill taller than the leading pushes its own line apart from its neighbours.',
      ).toEqual([]);
    });

    await walkthrough.step('scripture still dominates the canvas', async () => {
      const share = await page.evaluate((prefix: string) => {
        const canvas = document.querySelector('[data-testid="chapter-canvas"]');
        if (canvas === null) return 0;
        const box = canvas.getBoundingClientRect();
        const canvasArea = box.width * box.height;
        if (canvasArea <= 0) return 0;
        let badgeArea = 0;
        for (const pill of document.querySelectorAll(`[data-testid^="${prefix}"]`)) {
          const rect = pill.getBoundingClientRect();
          if (rect.bottom < box.top || rect.top > box.bottom) continue;
          badgeArea += rect.width * rect.height;
        }
        return badgeArea / canvasArea;
      }, INLINE_BADGE_PREFIX);

      expect(
        share,
        `pillar 1 (pristine reading canvas): ${(share * 100).toFixed(1)}% of the visible ` +
          'reading canvas is badge. Scripture must be the first thing the eye lands on.',
      ).toBeLessThan(MAX_BADGE_AREA_SHARE);
    });
  });

  test(`${BADGELESS_CHAPTER_REFERENCE} degrades to plain scripture`, async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step(`open ${BADGELESS_CHAPTER_REFERENCE}`, async () => {
      await openReader(page, BADGELESS_CHAPTER_PATH);
      await expect(page.getByTestId(verseId(1))).toBeVisible();
    });

    await walkthrough.step('there are no pills, and nothing apologises for it', async () => {
      const badgeIds = await inlineBadgeIds(page);
      expect(
        badgeIds,
        `${BADGELESS_CHAPTER_REFERENCE} was measured against the API as carrying no badges. ` +
          'Pills here would mean the reader is rendering something the server did not send.',
      ).toEqual([]);

      await expect(
        page.getByTestId('chapter-badge-summary'),
        'an empty summary list, or a heading over an empty rule, tells the reader ' +
          'something is missing. A chapter with no enrichment should simply read.',
      ).toHaveCount(0);
    });

    await walkthrough.step('the reader itself is unaffected', async () => {
      await expect(page.getByTestId(READER_IDS.canvas)).toBeVisible();
      await expect(page.getByTestId(READER_IDS.attribution)).toBeVisible();
    });
  });
});
