/**
 * Chapter 20 — what happens to an open sheet when the reader keeps reading.
 *
 * The journey
 *   Three states the earlier badge chapters never enter, because each of them opens a
 *   badge, asserts, and closes it before doing anything else:
 *     1. open a badge, follow a link out of it, and come back;
 *     2. open a badge and then change translation three times in a row, quickly;
 *     3. open a badge and scroll a 176-verse psalm to its last verse.
 *
 * Why these three
 *   An open sheet holds a badge id, and a badge id belongs to one chapter in one
 *   translation. Every one of these journeys invalidates that pairing while the sheet is
 *   still on screen. The graceful outcome is that the sheet closes or follows; the failure
 *   is a surface still showing Acts 16's route over another chapter's text, which is pillar
 *   3 in its most believable form — a citation, correctly rendered, for the wrong passage.
 *
 * Why the second one skips phone width, and what runs there instead
 *   Below 600 dp the badge opens as a bottom sheet whose scrim covers the whole viewport,
 *   so **no** reader control is reachable while it is open — measured, not assumed: the
 *   translation switcher resolves, is visible and enabled, and the scrim intercepts every
 *   click. That is a modal doing its job, which means "switch translation with the sheet
 *   open" is not a journey a phone reader can perform. Asserting it there would be
 *   inventing a failure. The phone gets the assertion that *is* true of it instead — the
 *   scrim really is modal, and tapping it really does close the sheet — and the rapid
 *   switching runs where the badge lives beside the canvas rather than over it.
 *
 * Dependencies
 *   The walkthrough fixtures, the badge journeys, the passage table, the API cross-check.
 */

import { unsourcedBadgeIds } from '../support/anchor-integrity';
import { BADGE_SURFACE_IDS } from '../support/badge-ids';
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
import { tap } from '../support/journeys';
import { ALL_TRANSLATIONS, JOHN_3, PSALM_119, passagePath } from '../support/passages';
import { anchorTextByBadgeId, fetchChapterBadges } from '../support/scripture-api';
import { READER_IDS, TRANSLATION_IDS, translationOptionId, verseId } from '../support/test-ids';
import type { WalkthroughViewport } from '../support/viewports';
import type { Page } from '@playwright/test';

/** The translation the reader starts in. */
const START_TRANSLATION = 'BSB';

/**
 * Open the first badge of a chapter and return its id.
 *
 * @param page The page to drive.
 * @param path Which chapter.
 * @param viewport The viewport under test.
 * @returns The badge id that was opened.
 */
async function openFirstBadge(
  page: Page,
  path: string,
  viewport: WalkthroughViewport,
): Promise<string> {
  await openBadgedChapter(page, path);
  const first = (await inlineBadgeIds(page))[0] ?? '';
  expect(first, `${path} rendered no pill to open`).not.toBe('');
  await openBadge(page, first, viewport);
  return first;
}

test.describe('20 · an open sheet while the reader keeps moving', () => {
  test('following a link out of a sheet, and coming back', async ({ page, walkthrough }) => {
    await walkthrough.step(`open a cross-reference in ${BADGE_CHAPTER_REFERENCE}`, async () => {
      await openBadgedChapter(page);
      const badgeId = firstOfEachKind(await inlineBadgeIds(page)).get('cross-ref');
      expect(badgeId, `${BADGE_CHAPTER_REFERENCE} has cross-references but no pill`).toBeDefined();
      expect(badgeKindOf(badgeId ?? '')).toBe('cross-ref');
      await openBadge(page, badgeId ?? '', walkthrough.viewport);
    });

    await walkthrough.step('follow one of the linked passages out of the chapter', async () => {
      await page.locator('[data-testid^="cross-ref-row-"]').first().click();
      await expect(page, 'tapping a linked passage did not navigate').not.toHaveURL(
        /\/read\/acts\/16$/,
      );

      // Catches: a surface keyed to a badge id that outlives the chapter that produced it.
      // The reader has just been carried to a different book; Acts 16's cross-reference
      // panel left open over it is a citation, correctly rendered, about a passage that is
      // no longer on screen. Chapter 13 proves the link navigates; nothing proves what the
      // sheet it was tapped inside does next.
      await expect(
        badgeSurface(page, walkthrough.viewport),
        'the cross-reference surface from Acts 16 is still open over the passage it linked to',
      ).toBeHidden();
      await expect(
        page.getByTestId(verseId(1)),
        'the linked chapter rendered no verse 1',
      ).toBeVisible();
    });

    await walkthrough.step('browser Back returns to the chapter, and to nothing else', async () => {
      await page.goBack();
      await expect(page, 'Back did not return to Acts 16').toHaveURL(/\/read\/acts\/16$/);
      await expect(page.getByTestId(verseId(1))).toBeVisible();

      // Catches: a sheet restored from state on the way back, covering the scripture the
      // reader asked to return to (pillar 1). Coming back to a chapter is a request for the
      // chapter, not for whatever was over it when they left.
      await expect(
        badgeSurface(page, walkthrough.viewport),
        'going back to Acts 16 reopened the badge surface the reader had left behind',
      ).toBeHidden();
      await expect(
        page.getByTestId(READER_IDS.canvas),
        'the reading canvas did not come back with the chapter',
      ).toBeVisible();
    });
  });

  test('the phone bottom sheet is genuinely modal', async ({ page, viewportName, walkthrough }) => {
    test.skip(
      viewportName !== 'phone',
      'above 600 dp the badge lives in the rail beside the canvas, and nothing is covered',
    );

    await walkthrough.step(`open a badge in ${JOHN_3.reference}`, async () => {
      await openFirstBadge(page, passagePath(JOHN_3), walkthrough.viewport);
    });

    await walkthrough.step('the reader chrome behind it cannot be reached', async () => {
      // Catches: a bottom sheet with no scrim, or one whose scrim does not cover the header.
      // The reader would then be able to change translation, open the navigator or step a
      // chapter with a badge still open over the canvas — every one of which leaves a
      // surface making a claim about a passage that is no longer underneath it. The 1500 ms
      // budget is a trial click, not a wait for anything: the assertion is that it is
      // refused, so a shorter budget makes the step faster without changing the answer.
      const reached = await page
        .getByTestId(TRANSLATION_IDS.switcher)
        .click({ timeout: 1_500 })
        .then(() => true)
        .catch(() => false);
      expect(
        reached,
        'the translation switcher is clickable while a badge sheet is open over the ' +
          'canvas. A half sheet with a scrim that does not block the header lets a reader ' +
          'change the text under a claim about the old text.',
      ).toBe(false);
    });

    await walkthrough.step('tapping the scrim closes it', async () => {
      // Catches: a scrim that blocks every control and dismisses nothing — a sheet a reader
      // can open and then not get out of, on the width where there is least room to look for
      // a close control.
      await page
        .getByRole('button', { name: /^Close / })
        .first()
        .click();
      await expect(
        badgeSurface(page, walkthrough.viewport),
        'the badge sheet did not close, so a phone reader is stuck inside it',
      ).toBeHidden();
      await expect(page.getByTestId(TRANSLATION_IDS.switcher)).toBeEnabled();
    });
  });

  test('switching translation repeatedly with a rail open leaves no stale claim', async ({
    page,
    viewportName,
    walkthrough,
  }) => {
    test.skip(
      viewportName === 'phone',
      'the phone sheet is modal by design, so this journey does not exist below 600 dp',
    );

    await walkthrough.step(`open a badge in ${JOHN_3.reference}`, async () => {
      await openFirstBadge(page, passagePath(JOHN_3), walkthrough.viewport);
    });

    await walkthrough.step('change translation three times without pausing', async () => {
      // Deliberately not waiting for the reader to settle between choices: the race this
      // step exists for only happens when a second switch lands while the first one's
      // chapter and badge requests are still in flight. Each tap still waits on the control
      // it is tapping, so this is fast, not timed.
      for (const code of ALL_TRANSLATIONS.slice(1)) {
        await tap(page, TRANSLATION_IDS.switcher, 'the translation switcher');
        await tap(page, translationOptionId(code), `the ${code} option`);
      }
      await expect(
        page.getByTestId(TRANSLATION_IDS.menu),
        'the switcher was left open over the scripture after rapid switching',
      ).toBeHidden();
    });

    await walkthrough.step('the reader settles on the last translation chosen', async () => {
      const last = ALL_TRANSLATIONS[ALL_TRANSLATIONS.length - 1] ?? START_TRANSLATION;
      const badges = await fetchChapterBadges(last, JOHN_3.book, JOHN_3.chapter);
      const anchors = anchorTextByBadgeId(badges);

      // Catches: an out-of-order response winning the race. Three switches issue three
      // chapter reads and three badge reads; if the client renders whichever arrives last
      // rather than whichever it asked for last, the reader ends up on a translation they
      // did not choose, showing pills the server never sent for it.
      await expect
        .poll(
          async () => unsourcedBadgeIds(await inlineBadgeIds(page), anchors),
          `after switching to ${last} the reader still shows pills the ${last} badge ` +
            'endpoint never sent, so a slower earlier response overwrote the chosen one',
        )
        .toEqual([]);
      await expect(page.getByTestId(verseId(1)), 'the chapter lost its scripture').toBeVisible();
    });

    await walkthrough.step('any surface still open belongs to what is on screen', async () => {
      // Catches: the rail surviving every switch while its badge did not. The rule asserted
      // is the weakest one that is still honest — the panel may close, and it may follow —
      // but it must not be chrome around a badge this translation no longer has.
      const surface = badgeSurface(page, walkthrough.viewport);
      if (!(await surface.isVisible())) return;
      await expect(
        surface.getByTestId(BADGE_SURFACE_IDS.teaser),
        'a badge surface is open after three translation changes but has no claim in it, ' +
          'so it is chrome around a badge that no longer exists',
      ).toBeVisible();
    });
  });

  test('a 176-verse psalm still reaches its end with a sheet open', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step(`open a badge in ${PSALM_119.reference}`, async () => {
      await openFirstBadge(page, passagePath(PSALM_119), walkthrough.viewport);
    });

    await walkthrough.step('scroll to verse 176 with the surface still up', async () => {
      const last = page.getByTestId(verseId(PSALM_119.verseCount));
      await last.scrollIntoViewIfNeeded();

      // Catches: a scroll container frozen while a surface is open — the usual way to keep a
      // modal still is to freeze the document, and on a 176-verse chapter that leaves the
      // reader on verse 1 with no error, no spinner and nothing that moves. This is a
      // programmatic scroll, so it proves the canvas is still scrollable, not that a finger
      // could reach past the phone scrim; chapter 14 owns how much of the canvas the sheet
      // covers.
      await expect(
        last,
        `${PSALM_119.reference} could not be scrolled to its last verse while a badge ` +
          'surface was open',
      ).toBeVisible();
    });

    await walkthrough.step('the chapter end is intact underneath it', async () => {
      // Catches: a canvas whose scroll extent shrinks when a surface opens, so the
      // attribution the licence requires — and the pager — become unreachable for as long as
      // a badge is open.
      await expect(
        page.getByTestId(READER_IDS.attribution),
        'the attribution line at the foot of the psalm is unreachable while a badge is open',
      ).toBeVisible();
    });
  });
});
