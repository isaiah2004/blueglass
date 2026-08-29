/**
 * Chapter 17 — the edges of the canon, and the books with only one chapter.
 *
 * The journey
 *   Stand at each of the three places where "the next chapter" stops being obvious:
 *   Genesis 1, where there is no previous; Revelation 22, where there is no next; and Jude,
 *   a book with no chapter 2, whose pager must roll into the neighbouring books instead.
 *   Then open the reference picker on a one-chapter book and count the tiles.
 *
 * Why it is worth its own chapter
 *   `reader-address.ts` is unit-tested across all 66 books, and that is the right place for
 *   the arithmetic. What a unit test cannot see is the **chrome**: `ChapterFooter` renders
 *   nothing at all when `onNext` is undefined, so at Revelation 22 the pager becomes a row
 *   with one control in it and at Genesis 1 a row with the other. Either can collapse, lose
 *   its alignment, or leave a labelled button that navigates nowhere — and the five
 *   one-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude) are where a chapter grid
 *   built around "at least two" shows what it does with one.
 *
 * Why it runs at phone width only
 *   The boundary is arithmetic plus one row of chrome, and the row is at its most cramped
 *   at 375 px — a pager that fits there fits everywhere. Running the same four journeys at
 *   three widths would triple the run to re-prove chapter 8's breakpoint work.
 *
 * Dependencies
 *   The walkthrough fixtures, the passage table, and the M1 test-id contract.
 */

import { expect, test } from '../support/fixtures';
import { openReader, tap } from '../support/journeys';
import { GENESIS_1, JUDE_1, OBADIAH_1, REVELATION_22, passagePath } from '../support/passages';
import { PICKER_IDS, READER_IDS, bookTileId, chapterTileId } from '../support/test-ids';

/** The picker is a sheet below the rail breakpoint and a rail above it. Match either. */
const PICKER_SURFACE = `[data-testid="${PICKER_IDS.sheet}"], [data-testid="${PICKER_IDS.rail}"]`;

test.describe('17 · the edges of the canon', () => {
  test.skip(
    ({ viewportName }) => viewportName !== 'phone',
    'the boundary is arithmetic plus one row of chrome, tightest at 375 px; chapter 8 owns widths',
  );

  test('Genesis 1 offers a way forward and none back', async ({ page, walkthrough }) => {
    await walkthrough.step('open Genesis 1', async () => {
      await openReader(page, passagePath(GENESIS_1));
    });

    await walkthrough.step('there is no previous chapter to step to', async () => {
      // Catches: a pager that clamps instead of hiding. A Previous control at Genesis 1
      // either navigates nowhere — a dead button in the one place a first-time reader is
      // most likely to press one — or wraps silently to Revelation 22, which is worse.
      await expect(
        page.getByTestId(READER_IDS.previousChapter),
        'Genesis 1 is the first chapter of the canon, so there is nothing before it. ' +
          'A Previous control here can only be dead or wrong.',
      ).toHaveCount(0);
    });

    await walkthrough.step('Next still works from the first chapter', async () => {
      // Catches: a footer that hides the whole pager when either side is empty, stranding
      // the reader in Genesis 1 with no way onward except the picker.
      await tap(page, READER_IDS.nextChapter, 'the next-chapter control');
      await expect(page, 'stepping forward from Genesis 1 did not reach Genesis 2').toHaveURL(
        /\/read\/genesis\/2$/,
      );
    });
  });

  test('Revelation 22 offers a way back and none forward', async ({ page, walkthrough }) => {
    await walkthrough.step('open Revelation 22', async () => {
      await openReader(page, passagePath(REVELATION_22));
    });

    await walkthrough.step('there is no next chapter to step to', async () => {
      // Catches: the mirror of the Genesis case, and the more likely one — an off-by-one
      // that reads `chapterCount + 1` produces a Next control here that requests a chapter
      // the API does not have, and the reader is shown an error at the end of the Bible.
      await expect(
        page.getByTestId(READER_IDS.nextChapter),
        'Revelation 22 is the last chapter of the canon, so there is nothing after it',
      ).toHaveCount(0);
    });

    await walkthrough.step('Previous still works from the last chapter', async () => {
      await tap(page, READER_IDS.previousChapter, 'the previous-chapter control');
      await expect(page, 'stepping back from Revelation 22 did not reach Revelation 21').toHaveURL(
        /\/read\/revelation\/21$/,
      );
    });
  });

  test('a one-chapter book pages into its neighbours', async ({ page, walkthrough }) => {
    await walkthrough.step(`open ${JUDE_1.reference}`, async () => {
      await openReader(page, passagePath(JUDE_1));
    });

    await walkthrough.step('stepping forward leaves the book entirely', async () => {
      // Catches: a pager that computes `chapter + 1` within the book. Jude has no chapter 2,
      // so the only correct Next is Revelation 1 — a different book, a different chapter
      // count, and a route the reader never typed. Five books in the canon behave this way.
      await tap(page, READER_IDS.nextChapter, 'the next-chapter control');
      await expect(page, 'Next from Jude 1 did not roll into Revelation 1').toHaveURL(
        /\/read\/revelation\/1$/,
      );
    });

    await walkthrough.step('stepping back returns across the same boundary', async () => {
      // Catches: a rollback that lands on chapter 1 of the previous book rather than its
      // last chapter. Jude is one chapter long, so Previous from Revelation 1 must be
      // Jude 1 and the asymmetry is invisible; the Obadiah test below covers the other side.
      await tap(page, READER_IDS.previousChapter, 'the previous-chapter control');
      await expect(page, 'Previous from Revelation 1 did not return to Jude 1').toHaveURL(
        /\/read\/jude\/1$/,
      );
    });
  });

  test('the picker offers exactly one chapter for a one-chapter book', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step('open the reference picker', async () => {
      await openReader(page, passagePath(GENESIS_1));
      await tap(page, PICKER_IDS.open, 'the reference-picker control');
      await expect(page.locator(PICKER_SURFACE)).toBeVisible();
    });

    await walkthrough.step(`choose ${OBADIAH_1.reference.split(' ')[0] ?? 'Obadiah'}`, async () => {
      await tap(page, bookTileId(OBADIAH_1.book), "the picker's Obadiah tile");

      // Catches: a chapter grid built from a hard-coded range, or from `Array.from({length:
      // chapters - 1})`. Obadiah has exactly one chapter; a grid showing two offers a tile
      // that leads to a chapter the API will refuse, and a grid showing none strands the
      // reader in a book they cannot enter.
      const tiles = page.locator('[data-testid^="chapter-tile-"]');
      await expect(
        tiles,
        'Obadiah has one chapter. Any other number of tiles is a grid that does not read ' +
          'the book it was given.',
      ).toHaveCount(1);
    });

    await walkthrough.step('the single tile reaches the chapter', async () => {
      await tap(page, chapterTileId(1), "the picker's chapter 1 tile");
      await expect(page, 'the picker did not navigate to Obadiah 1').toHaveURL(
        /\/read\/obadiah\/1$/,
      );
      await expect(
        page.locator(PICKER_SURFACE),
        'the picker stayed open over the scripture after navigating',
      ).toBeHidden();
    });
  });
});
