/**
 * The shared moves of a walkthrough, and the facts every chapter agrees on.
 *
 * Purpose
 *   Ten chapters all need to launch the app, reach a tab, and open the reader. Written out
 *   ten times, those three moves drift: one chapter waits for the route, another for the
 *   heading, a third for neither, and the suite starts failing for reasons that are about
 *   the harness rather than the app. They live here once.
 *
 * The constants are decisions, not conveniences
 *   `S-01` ships multiple open translations behind a switcher; the four public-domain texts
 *   below, and BSB as the default, are the set recorded in `docs/decisions/ASSUMPTIONS.md`
 *   and loaded by `pnpm db:seed`. The licensed families are the ones that must never appear
 *   in the switcher — ESV is in the mockups and would be an easy, expensive mistake to copy.
 *   (That assumption row is cited as `Q-024` in ASSUMPTIONS.md, which now collides with a
 *   real hub question of the same number; cite it by subject, not by id.)
 *
 * Dependencies
 *   `@playwright/test` for `expect` and `Page`, and the test-id contract.
 */

import { expect, type Locator, type Page } from '@playwright/test';

import { READER_IDS, TAB_IDS, verseId } from './test-ids';

/** The four public-domain translations the app ships. */
export const OPEN_TRANSLATIONS: readonly string[] = ['BSB', 'KJV', 'WEB', 'ASV'];

/** The default translation: modern English, and the PRD's stated launch preference. */
export const DEFAULT_TRANSLATION = 'BSB';

/**
 * Translations that are licensed and must never be offered.
 *
 * ESV heads the list because it appears throughout the reference mockups; shipping it
 * would be a copyright violation dressed as a design decision.
 */
export const LICENSED_TRANSLATIONS: readonly string[] = ['ESV', 'NIV', 'NASB', 'NLT', 'CSB', 'MSG'];

/** Where the MVP reading plan starts — the 30-day Book of Acts plan. */
export const READER_START = { book: 'acts', chapter: 1 } as const;

/** The reader route for the start of the plan. */
export const READER_START_PATH = `/read/${READER_START.book}/${String(READER_START.chapter)}`;

/** How few verses would mean the chapter did not really load. Acts 1 has 26. */
export const MIN_VERSES_IN_A_CHAPTER = 5;

/**
 * How long the first painted verse of a chapter may take.
 *
 * The config's 10 s `expect` timeout is right for an element that is either in the tree or
 * is not. Scripture is neither: it is an HTTP round trip behind a bundle that may still be
 * compiling, so this wait absorbs the cold start the whole suite pays once per project.
 * Measured on this machine: 7-9 s for these steps with four workers, and past 10 s under
 * the six the full run uses — two tablet chapters failed a full run and passed in
 * isolation, which is a harness budget rather than an app defect.
 *
 * This changes the patience, never the assertion: verse 1 must still be on screen, and a
 * reader that renders no scripture still fails the run. `openBadgedChapter` already makes
 * the same exception, for the same reason, with the same number.
 */
const FIRST_PAINT_TIMEOUT_MS = 30_000;

/**
 * Launch the app at a route and wait for React to have mounted something.
 *
 * This is a **precondition**, not an assertion: it establishes that the bundle is running
 * so the chapter's own assertions mean something. It deliberately does not require the
 * `app-root` test id — chapter 1 owns that contract, and if every chapter demanded it here
 * then one missing prop would report as sixty identical failures and hide every other
 * finding in the run.
 *
 * @param page The page to drive.
 * @param path The route to open. Defaults to the home tab.
 * @throws {Error} If nothing ever mounts, which means the bundle failed rather than the app.
 */
export async function launchApp(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await page
    .waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0)
    .catch((cause: unknown) => {
      throw new Error(
        `Nothing mounted at ${path}: the page loaded but React rendered no tree. ` +
          'This is a bundle or runtime failure, not a missing feature.',
        { cause },
      );
    });
}

/**
 * Tap a control, having first said what it is.
 *
 * Playwright's own failure for a control that never appeared is
 * `locator.click: Timeout 15000ms exceeded`, which names neither the element nor the
 * reason. Asserting visibility first turns that into a sentence a person can act on, at
 * the cost of one extra assertion.
 *
 * @param page The page to drive.
 * @param testId The control's test id.
 * @param what What the control is, in the words of the journey.
 */
export async function tap(page: Page, testId: string, what: string): Promise<void> {
  const control = page.getByTestId(testId);
  await expect(
    control,
    `${what} (testID "${testId}") is not on screen, so it cannot be tapped`,
  ).toBeVisible();
  await control.click();
}

/**
 * Tap a tab and wait for its route.
 *
 * @param page The page to drive.
 * @param tab Which tab, by contract key.
 * @param expectedUrl The route the tap must land on.
 */
export async function openTab(
  page: Page,
  tab: keyof typeof TAB_IDS,
  expectedUrl: RegExp,
): Promise<void> {
  // Asserted before the click rather than left to the click's own timeout. A bare
  // `locator.click: Timeout 15000ms exceeded` names neither the control nor the reason,
  // and it is the single least useful failure a walkthrough can produce.
  const control = page.getByTestId(TAB_IDS[tab]);
  await expect(
    control,
    `the ${tab} tab control (testID "${TAB_IDS[tab]}") is not on screen, so it cannot be tapped`,
  ).toBeVisible();
  await control.click();
  await expect(page, `tapping the ${tab} tab did not navigate`).toHaveURL(expectedUrl);
}

/**
 * Open the reading canvas and wait for scripture to be on screen.
 *
 * @param page The page to drive.
 * @param path Which chapter. Defaults to the start of the Acts plan.
 * @returns A locator for the reader screen.
 */
export async function openReader(page: Page, path: string = READER_START_PATH): Promise<Locator> {
  await launchApp(page, path);
  const reader = page.getByTestId(READER_IDS.screen);
  await expect(
    reader,
    `the reader (testID "${READER_IDS.screen}") never appeared at ${path}`,
  ).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(
    firstVerse(page),
    `the reader rendered but verse 1 (testID "${verseId(1)}") did not. ` +
      'A reader with no scripture in it is the one failure milestone M1 cannot ship.',
  ).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  return reader;
}

/**
 * The first verse of the open chapter.
 *
 * @param page The page to query.
 * @returns A locator for verse 1.
 */
export function firstVerse(page: Page): Locator {
  return page.getByTestId(verseId(1));
}

/**
 * Every verse number the reader has rendered, in DOM order.
 *
 * Asking the DOM rather than assuming a count keeps the harness honest about virtualised
 * lists: if the reader windows its verses, this returns what is mounted, and the chapter
 * that cares can scroll and ask again.
 *
 * The prefix is `verse-row-`, which is what `VerseRow` renders and what `verseId()`
 * builds. It used to be `reader-verse-`, a name nothing has ever carried, so this returned
 * an empty array on a perfectly rendered chapter — a silent zero that only three chapters
 * depended on and that a tap-target failure happened to mask.
 *
 * @param page The page to query.
 * @returns The verse numbers currently in the tree.
 */
export async function renderedVerseNumbers(page: Page): Promise<number[]> {
  const prefix = verseId(0).replace(/0$/, '');
  return page.evaluate(
    (idPrefix: string) =>
      Array.from(document.querySelectorAll(`[data-testid^="${idPrefix}"]`))
        .map((element) =>
          Number((element.getAttribute('data-testid') ?? '').slice(idPrefix.length)),
        )
        .filter((value) => Number.isInteger(value) && value > 0),
    prefix,
  );
}

/**
 * The trimmed text of one verse, for comparing before and after a translation change.
 *
 * @param page The page to query.
 * @param verse The verse number.
 * @returns The rendered text with whitespace collapsed.
 */
export async function verseText(page: Page, verse: number): Promise<string> {
  const raw = (await page.getByTestId(verseId(verse)).innerText()).trim();
  return raw.replace(/\s+/g, ' ');
}
