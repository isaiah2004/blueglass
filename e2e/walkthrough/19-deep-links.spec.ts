/**
 * Chapter 19 — arriving by URL, and moving through history.
 *
 * The journey
 *   Three things a reader on the web does that no earlier chapter drives: land on a chapter
 *   URL cold, having navigated to nothing; reload while standing on it; and walk backwards
 *   and forwards through several chapters with the browser's own buttons.
 *
 * Why "the suite already uses page.goto" is not the same thing
 *   Every chapter reaches the reader with `openReader`, which is a `goto` — but always to
 *   Acts 1 or Acts 16, always the chapter the app would have opened anyway, and never
 *   followed by a reload or by more than one Back. A deep link is a different code path in
 *   two ways that matter: the route parameters are the **only** source of the address, so a
 *   reader that keeps its position in a store and treats the URL as decoration renders the
 *   wrong chapter; and the shell mounts around an already-chosen route rather than
 *   navigating into it, so a tab bar that highlights on tap is highlighting nothing.
 *
 * Why Back and Forward, several times
 *   Chapter 5 presses Back once, after a picker navigation. One Back can be satisfied by an
 *   app that pushes a single history entry and then unwinds its own state. Three Backs and
 *   two Forwards cannot: they require every navigation to have pushed a real entry, in
 *   order, and the reader to rebuild from whichever entry it is handed. `T-01` makes web a
 *   first-class target, and this is the promise a website makes that an app does not.
 *
 * Dependencies
 *   The walkthrough fixtures, the passage table, and the M1 test-id contract.
 */

import { expect, test } from '../support/fixtures';
import {
  MIN_VERSES_IN_A_CHAPTER,
  launchApp,
  openReader,
  renderedVerseNumbers,
  tap,
} from '../support/journeys';
import { OBADIAH_1, PSALM_119, REVELATION_22, passagePath } from '../support/passages';
import { READER_IDS, SHELL_IDS, verseId } from '../support/test-ids';

/** The chapters walked through history, in the order they are visited. */
const HISTORY_WALK = ['/read/genesis/1', '/read/genesis/2', '/read/genesis/3'] as const;

test.describe('19 · deep links and browser history', () => {
  test('a chapter URL opened cold renders that chapter', async ({ page, walkthrough }) => {
    await walkthrough.step(`land on ${PSALM_119.reference} without navigating to it`, async () => {
      await launchApp(page, passagePath(PSALM_119));

      // Catches: a reader that reads its address from a store rather than from the route.
      // Such a reader opens the last chapter the store remembers — Acts 1 on a fresh
      // profile — while the address bar says Psalms 119. A shared link then shows the
      // wrong passage to whoever opens it, and nothing anywhere reports an error.
      await expect(
        page.getByTestId(READER_IDS.screen),
        `deep-linking to ${passagePath(PSALM_119)} did not reach the reader`,
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId(verseId(1))).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByTestId(READER_IDS.chapterTitle),
        `the reader opened at ${passagePath(PSALM_119)} but its heading names another chapter`,
      ).toContainText('119');
    });

    await walkthrough.step('the shell is around it, not bypassed', async () => {
      // Catches: a route that renders the reader outside the tab shell when it is entered
      // directly. The reader is then a page with no way out — no tabs, no theme control —
      // which is exactly what a shared link lands a first-time visitor in.
      await expect(
        page.getByTestId(SHELL_IDS.tabBar),
        'a deep-linked chapter rendered without the shell around it, so there is no way ' +
          'out of it and no way into the rest of the app',
      ).toBeVisible();
    });

    await walkthrough.step('reloading stays on the same chapter', async () => {
      await page.reload();

      // Catches: a reload that resets to the default route. On the web a reload is the
      // reader's normal response to anything looking wrong, and losing their place is how
      // an app teaches people not to trust it.
      await expect(page, 'reloading a deep link left the chapter').toHaveURL(
        /\/read\/psalms\/119$/,
      );
      await expect(page.getByTestId(verseId(1))).toBeVisible({ timeout: 30_000 });
    });
  });

  test('a deep link computes its own neighbours, not the default chapter’s', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step(`land on ${REVELATION_22.reference} directly`, async () => {
      await openReader(page, passagePath(REVELATION_22));
    });

    await walkthrough.step('the pager belongs to the chapter in the address bar', async () => {
      // Catches: a footer whose Previous/Next are derived from a stored "current chapter"
      // rather than from the route. On a deep link the two disagree, and the reader is
      // offered a step into a chapter with no relationship to what is on screen. Revelation
      // 22 is the sharpest case: the correct answer is "no Next at all".
      await expect(
        page.getByTestId(READER_IDS.nextChapter),
        'a deep link to the last chapter of the canon still offers a step forward',
      ).toHaveCount(0);
      await expect(
        page.getByTestId(READER_IDS.previousChapter),
        'a deep link to Revelation 22 offers no step back, so the pager is not reading the route',
      ).toBeVisible();
    });
  });

  test('a one-chapter book can be reached by URL alone', async ({ page, walkthrough }) => {
    await walkthrough.step(`land on ${OBADIAH_1.reference} directly`, async () => {
      await openReader(page, passagePath(OBADIAH_1));

      // Catches: a route parser that requires a chapter greater than 1 to disambiguate, or
      // a book slug lookup that only knows the books the picker happens to have listed.
      // Obadiah is the shortest book in the Old Testament and the least likely to have been
      // tried by hand.
      const numbers = await renderedVerseNumbers(page);
      expect(
        numbers.length,
        `${OBADIAH_1.reference} rendered ${String(numbers.length)} verses from a bare URL`,
      ).toBeGreaterThanOrEqual(MIN_VERSES_IN_A_CHAPTER);
    });
  });

  test('Back and Forward walk the chapters actually visited', async ({ page, walkthrough }) => {
    await walkthrough.step('read three chapters in a row', async () => {
      await openReader(page, HISTORY_WALK[0]);
      await tap(page, READER_IDS.nextChapter, 'the next-chapter control');
      await expect(page).toHaveURL(/\/read\/genesis\/2$/);
      await tap(page, READER_IDS.nextChapter, 'the next-chapter control');
      await expect(page).toHaveURL(/\/read\/genesis\/3$/);
    });

    await walkthrough.step('Back twice returns through both of them', async () => {
      await page.goBack();

      // Catches: navigation that replaces the history entry instead of pushing one. With a
      // single step it is indistinguishable from correct; with two, the second Back leaves
      // the app entirely and the reader is thrown out of the product by a button they use
      // dozens of times a day.
      await expect(page, 'the first Back did not return to Genesis 2').toHaveURL(
        /\/read\/genesis\/2$/,
      );
      await expect(page.getByTestId(verseId(1))).toBeVisible();

      await page.goBack();
      await expect(page, 'the second Back did not return to Genesis 1').toHaveURL(
        /\/read\/genesis\/1$/,
      );
      await expect(
        page.getByTestId(verseId(1)),
        'Genesis 1 rendered no scripture after two Backs, so the reader restored the ' +
          'route without refetching the chapter',
      ).toBeVisible();
    });

    await walkthrough.step('Forward twice replays them in order', async () => {
      await page.goForward();
      await expect(page, 'Forward did not return to Genesis 2').toHaveURL(/\/read\/genesis\/2$/);
      await page.goForward();

      // Catches: a forward stack the app discards on its own navigation, and a reader that
      // repaints the heading from the URL while leaving the previous chapter's verses on
      // screen — the failure that looks correct in every screenshot of the address bar.
      await expect(page, 'Forward did not reach Genesis 3').toHaveURL(/\/read\/genesis\/3$/);
      await expect(
        page.getByTestId(READER_IDS.chapterTitle),
        'the heading does not name Genesis 3 after walking forward to it',
      ).toContainText('3');
    });
  });
});
