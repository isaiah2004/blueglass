/**
 * Chapter 5 · Navigating book and chapter.
 *
 * Two ways to move, both ported from the prototype's behaviour (`flutter-port-map.md` §2):
 * step to the next chapter, or tap the chapter title and pick any of the 66 books. This
 * chapter drives both, and then presses the browser Back button — because web is a
 * first-class target (`T-01`), and a reader who cannot go back is on a broken website
 * however good the app feels.
 *
 * Routes: `/read/acts/1`, `/read/acts/2`, `/read/john/3`
 */

import { expect, test } from '../support/fixtures';
import {
  MIN_VERSES_IN_A_CHAPTER,
  openReader,
  renderedVerseNumbers,
  tap,
} from '../support/journeys';
import { PICKER_IDS, READER_IDS, bookTileId, chapterTileId, verseId } from '../support/test-ids';

/**
 * The picker is a sheet below the rail breakpoint and a rail above it, with two different
 * test ids. Matching either keeps one chapter honest at all three widths instead of
 * forking it into two nearly identical ones.
 */
const PICKER_SURFACE = `[data-testid="${PICKER_IDS.sheet}"], [data-testid="${PICKER_IDS.rail}"]`;

test.describe('chapter 5 · navigating book and chapter', () => {
  test('the reader steps forward and back a chapter', async ({ page, walkthrough }) => {
    await walkthrough.step('open Acts 1', async () => {
      await openReader(page);
    });

    await walkthrough.step('step to the next chapter', async () => {
      await tap(page, READER_IDS.nextChapter, 'the next-chapter control');

      // Catches: a next-chapter control that changes the heading without changing the
      // route. On web that breaks sharing, bookmarking and Back all at once.
      await expect(page, 'stepping forward did not change the route').toHaveURL(/\/read\/acts\/2$/);
      await expect(
        page.getByTestId(verseId(1)),
        'Acts 2 rendered no verse 1 — the chapter changed but the fetch did not follow',
      ).toBeVisible();
    });

    await walkthrough.step('the new chapter is fully there', async () => {
      const numbers = await renderedVerseNumbers(page);

      // Catches: a reader that renders the new chapter's heading over the old chapter's
      // verses, or fetches an empty body and shows the frame around nothing.
      expect(
        numbers.length,
        `Acts 2 rendered only ${String(numbers.length)} verses`,
      ).toBeGreaterThanOrEqual(MIN_VERSES_IN_A_CHAPTER);
    });

    await walkthrough.step('step back a chapter', async () => {
      await tap(page, READER_IDS.previousChapter, 'the previous-chapter control');
      await expect(page, 'stepping back did not return to Acts 1').toHaveURL(/\/read\/acts\/1$/);
    });
  });

  test('the reference picker reaches another book', async ({ page, walkthrough }) => {
    await walkthrough.step('open the reference picker from the chapter title', async () => {
      await openReader(page);
      await tap(page, PICKER_IDS.open, 'the reference-picker control');

      // Catches: a picker control that renders but is not wired. It is the only way into the
      // 66-book grid, so a dead control strands the reader in whichever book they opened.
      await expect(
        page.locator(PICKER_SURFACE),
        `opening the navigator produced no picker (expected "${PICKER_IDS.sheet}" or "${PICKER_IDS.rail}")`,
      ).toBeVisible();
    });

    await walkthrough.step('choose John, then chapter 3', async () => {
      await tap(page, bookTileId('john'), "the picker's John tile");
      await tap(page, chapterTileId(3), "the picker's chapter 3 tile");

      // Catches: a picker that resolves a book by display name rather than by id. The
      // prototype mapped only 3 of 66 books and wrote `book_number: 0` for the rest
      // (DECISIONS.md §4) — this is the walkthrough-level guard against porting that bug.
      await expect(page, 'the picker did not navigate to John 3').toHaveURL(/\/read\/john\/3$/);
    });

    await walkthrough.step('the picker closes and John 3 is on screen', async () => {
      // Catches: a modal left mounted over the canvas after navigating — pillar 1 again,
      // and on phone it would hide the entire chapter the reader just asked for.
      await expect(
        page.locator(PICKER_SURFACE),
        'the reference picker stayed open over the scripture after navigating',
      ).toBeHidden();
      await expect(page.getByTestId(verseId(16)), 'John 3:16 did not render').toBeVisible();
    });

    await walkthrough.step('the browser Back button returns to Acts 1', async () => {
      await page.goBack();

      // Catches: navigation performed by mutating state instead of pushing history. This is
      // the single most common way a React Native app ported to web feels broken, and it is
      // invisible on device where there is no address bar.
      await expect(page, 'browser Back did not return to the previous chapter').toHaveURL(
        /\/read\/acts\/1$/,
      );
      await expect(
        page.getByTestId(verseId(1)),
        'Acts 1 did not re-render after Back',
      ).toBeVisible();
    });
  });
});
