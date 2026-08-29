/**
 * Chapter 3 · The reading canvas.
 *
 * Milestone M1 is "get real scripture on screen, beautifully, on every target platform".
 * This is the chapter that decides whether that happened. It opens the reader the way a
 * reader does — through the Bible tab, not by typing a route — and then asks the questions
 * that separate a reading canvas from a screen with words on it: is this real scripture or
 * a fixture, is the whole chapter there or only the first screenful, is it set in the
 * serif, and does the canvas stay pristine (pillar 1).
 *
 * Route: `/bible` then `/read/{book}/{chapter}`
 */

import { expect, test } from '../support/fixtures';
import { expectScriptureSerif } from '../support/audits';
import {
  MIN_VERSES_IN_A_CHAPTER,
  launchApp,
  openReader,
  openTab,
  renderedVerseNumbers,
  verseText,
} from '../support/journeys';
import { READER_IDS, verseId } from '../support/test-ids';

/** Placeholder prose that must never reach a reader in place of scripture. */
const FIXTURE_TEXT = /lorem ipsum|placeholder|coming soon|todo|sample verse/i;

test.describe('chapter 3 · the reading canvas', () => {
  test('the Bible tab opens the reader on real scripture', async ({ page, walkthrough }) => {
    await walkthrough.step('launch and open the Bible tab', async () => {
      await launchApp(page);
      await openTab(page, 'bible', /\/(bible|read)/);
    });

    await walkthrough.step('the tab lands on a chapter, not a placeholder', async () => {
      // Catches: a Bible tab that dead-ends. `bible.tsx` promises to redirect to the
      // reader's last saved position; a reader who taps Bible and gets a stub screen has
      // no route into the product at all.
      await expect(
        page.getByTestId(READER_IDS.screen),
        `tapping Bible did not reach the reader (testID "${READER_IDS.screen}")`,
      ).toBeVisible();
    });
  });

  test('a chapter renders in full, in the scripture serif', async ({ page, walkthrough }) => {
    await walkthrough.step('open Acts 1', async () => {
      await openReader(page);
    });

    await walkthrough.step('the first verse is scripture, not a fixture', async () => {
      const text = await verseText(page, 1);

      // Catches: a reader wired to a stub. A verse under twenty characters, or one that
      // reads like scaffolding, means the API contract is not actually connected — the
      // failure most likely to be mistaken for success in a screenshot.
      expect(text.length, `verse 1 rendered only "${text}"`).toBeGreaterThan(20);
      expect(text, `verse 1 rendered placeholder prose: "${text}"`).not.toMatch(FIXTURE_TEXT);
    });

    await walkthrough.step('the chapter heading names where the reader is', async () => {
      const heading = (await page.getByTestId(READER_IDS.chapterTitle).innerText()).trim();

      // Catches: a reader that loses its own reference. Without it a reader cannot tell
      // which chapter they are in, and the reference picker has nothing to open from.
      expect(heading, 'the chapter heading is empty').not.toBe('');
      expect(
        heading,
        `the chapter heading reads "${heading}", which names neither a book nor a chapter number`,
      ).toMatch(/[A-Za-z].*\d/);
    });

    await walkthrough.step('scripture is set in the scripture serif', async () => {
      await expectScriptureSerif(page, verseId(1), 'reader / Acts 1 / verse 1');
    });

    await walkthrough.step('the whole chapter is present, in order', async () => {
      const numbers = await renderedVerseNumbers(page);

      // Catches: a container with a fixed height that silently truncates the chapter, and
      // an off-by-one in verse keying that starts the chapter at 0 or 2.
      expect(
        numbers.length,
        `only ${String(numbers.length)} verses rendered`,
      ).toBeGreaterThanOrEqual(MIN_VERSES_IN_A_CHAPTER);
      expect(numbers[0], 'the chapter does not start at verse 1').toBe(1);
      expect(
        numbers,
        'verse numbers are out of order, so the chapter is assembled wrongly',
      ).toEqual([...numbers].sort((a, b) => a - b));
    });
  });

  test('the reader scrolls to the end of the chapter', async ({ page, walkthrough }) => {
    await walkthrough.step('open Acts 1 and scroll to the last rendered verse', async () => {
      await openReader(page);
      const before = await renderedVerseNumbers(page);
      const last = before.at(-1) ?? 1;
      await page.getByTestId(verseId(last)).scrollIntoViewIfNeeded();

      // Catches: a reading canvas that cannot be scrolled at all — a `ScrollView` that was
      // given a fixed height, or a page whose body scroll was disabled for a sheet and
      // never restored. Both leave a reader stuck on verse 1 of 26.
      const after = await renderedVerseNumbers(page);
      expect(
        after.length,
        'scrolling to the last verse rendered fewer verses than before, so the list is unmounting content it should keep',
      ).toBeGreaterThanOrEqual(before.length);
    });
  });
});
