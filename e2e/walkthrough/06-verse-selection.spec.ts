/**
 * Chapter 6 · Selecting a verse.
 *
 * Pillar 2 says context arrives where the reader already is, never via a detour. That makes
 * verse selection a structural assertion, not a cosmetic one: tapping a verse must open a
 * surface *over* the reading canvas while the chapter stays mounted behind it. A detail
 * screen that replaces the reader would pass a naive "the sheet opened" test and fail the
 * product.
 *
 * Route: `/read/acts/1`
 */

import { expect, test } from '../support/fixtures';
import { openReader, tap } from '../support/journeys';
import { READER_IDS, VERSE_SHEET_IDS, verseId } from '../support/test-ids';

/** The verse this chapter opens. Acts 1:8 is the book's thesis, and always present. */
const TARGET_VERSE = 8;

test.describe('chapter 6 · selecting a verse', () => {
  test('tapping a verse opens its detail over the canvas', async ({ page, walkthrough }) => {
    await walkthrough.step('open Acts 1', async () => {
      await openReader(page);
    });

    await walkthrough.step(`tap verse ${String(TARGET_VERSE)}`, async () => {
      await tap(page, verseId(TARGET_VERSE), `verse ${String(TARGET_VERSE)}`);

      // Catches: a verse row that renders as plain text with no press handler, which is the
      // failure the inline-badge spike already proved is easy to introduce — an inline
      // `<View>` inside a `<Text>` can quietly stop being hit-testable.
      await expect(
        page.getByTestId(VERSE_SHEET_IDS.root),
        `tapping verse ${String(TARGET_VERSE)} opened no detail surface (testID "${VERSE_SHEET_IDS.root}")`,
      ).toBeVisible();
    });

    await walkthrough.step('the sheet names the verse it is showing', async () => {
      const reference = (await page.getByTestId(VERSE_SHEET_IDS.reference).innerText()).trim();

      // Catches: a sheet wired to a stale or hardcoded reference. The prototype's verse
      // panel was fed from shared mutable state, so opening one verse and then another
      // could show the first verse's study note under the second verse's heading.
      expect(
        reference,
        `the sheet is headed "${reference}", not the verse that was tapped`,
      ).toMatch(new RegExp(`\\b1[:.]${String(TARGET_VERSE)}\\b`));
    });

    await walkthrough.step('the chapter is still there behind it', async () => {
      // Catches: navigation to a detail *route* instead of an overlay. That is the detour
      // pillar 2 forbids: the reader loses their place, and Back becomes the only way home.
      await expect(
        page.getByTestId(READER_IDS.screen),
        'the reader unmounted when a verse was selected — this is a detour, not point-of-need context',
      ).toBeVisible();
      await expect(page, 'selecting a verse changed the route').toHaveURL(/\/read\/acts\/1/);
    });

    await walkthrough.step('closing returns the reader to the chapter', async () => {
      await tap(page, VERSE_SHEET_IDS.close, "the verse sheet's close control");

      // Catches: a close control that hides the sheet but leaves its scrim mounted, which
      // makes the whole chapter unclickable — a bug that looks perfect in a screenshot.
      await expect(
        page.getByTestId(VERSE_SHEET_IDS.root),
        'the verse sheet did not close',
      ).toBeHidden();
      await tap(page, verseId(1), 'verse 1');
      await expect(
        page.getByTestId(VERSE_SHEET_IDS.root),
        'the reader stopped responding to taps after the sheet closed, so something invisible is still covering it',
      ).toBeVisible();
    });
  });

  test('selecting a second verse updates the detail', async ({ page, walkthrough }) => {
    await walkthrough.step('open one verse, then another', async () => {
      await openReader(page);
      await tap(page, verseId(1), 'verse 1');
      await expect(
        page.getByTestId(VERSE_SHEET_IDS.reference),
        `the detail surface for verse 1 (testID "${VERSE_SHEET_IDS.reference}") is not showing Acts 1:1`,
      ).toContainText(/\b1[:.]1\b/);
      await tap(page, verseId(TARGET_VERSE), `verse ${String(TARGET_VERSE)}`);

      // Catches: a sheet that memoises its first verse and never updates — the reader taps
      // verse 8 and reads verse 1's context, which is a zero-hallucination failure by
      // plumbing rather than by model.
      await expect(
        page.getByTestId(VERSE_SHEET_IDS.reference),
        'the detail surface kept showing the first verse that was tapped',
      ).toContainText(new RegExp(`\\b1[:.]${String(TARGET_VERSE)}\\b`));
    });
  });
});
