/**
 * Chapter 9 · Searching scripture.
 *
 * The prototype's full-screen search screen was dead code; the surface that shipped was an
 * overlay *over* the reader, deliberately, so the reader never loses their place
 * (`flutter-port-map.md` §2). That behaviour is the point of this chapter: it checks that
 * search finds real verses, that it says so honestly when it finds none, and that opening
 * and using it never costs the reader the chapter they were in.
 *
 * Route: `/read/acts/1` with the search overlay open
 */

import { expect, test } from '../support/fixtures';
import { openReader, tap } from '../support/journeys';
import { READER_IDS, SEARCH_IDS, searchResultId } from '../support/test-ids';

/** A word certain to appear in Acts in every translation the app ships. */
const QUERY = 'Jerusalem';

/** A string that cannot match anything, used to reach the empty state deterministically. */
const NONSENSE_QUERY = 'zzqqxv';

test.describe('chapter 9 · searching scripture', () => {
  test('search finds real verses without losing the reader place', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step('open the reader, then open search', async () => {
      await openReader(page);
      await tap(page, SEARCH_IDS.open, 'the search control');

      await expect(
        page.getByTestId(SEARCH_IDS.root),
        `the search surface (testID "${SEARCH_IDS.root}") did not open`,
      ).toBeVisible();

      // Catches: search implemented as a route rather than an overlay. The prototype
      // already made and reverted that decision; re-making it means a reader who searches
      // mid-chapter has to navigate their way back.
      await expect(
        page.getByTestId(READER_IDS.screen),
        'opening search unmounted the reader, so the reader lost their place',
      ).toBeVisible();
    });

    await walkthrough.step(`search for "${QUERY}"`, async () => {
      await page.getByTestId(SEARCH_IDS.input).fill(QUERY);

      await expect(
        page.getByTestId(SEARCH_IDS.results),
        `searching for "${QUERY}" produced no result list`,
      ).toBeVisible();

      // Catches: a results list wired to the wrong query, or one that renders references
      // without the matched text. Requiring the term in the first result is what
      // distinguishes "search ran" from "search worked".
      await expect(
        page.getByTestId(searchResultId(0)),
        `the first result for "${QUERY}" does not contain the word searched for`,
      ).toContainText(new RegExp(QUERY, 'i'));
    });

    await walkthrough.step('opening a result takes the reader there', async () => {
      await tap(page, searchResultId(0), 'the first search result');

      // Catches: a result row that is not pressable, and one that navigates without closing
      // the overlay — pillar 1, no floating surface left over the scripture.
      await expect(
        page.getByTestId(SEARCH_IDS.root),
        'the search overlay stayed open over the passage it navigated to',
      ).toBeHidden();
      await expect(page, 'opening a search result did not reach a chapter').toHaveURL(/\/read\//);
      await expect(
        page.getByTestId(READER_IDS.screen),
        'the reader is not showing after opening a search result',
      ).toBeVisible();
    });
  });

  test('a query with no matches says so', async ({ page, walkthrough }) => {
    await walkthrough.step('search for something that cannot exist', async () => {
      await openReader(page);
      await tap(page, SEARCH_IDS.open, 'the search control');
      await page.getByTestId(SEARCH_IDS.input).fill(NONSENSE_QUERY);

      // Catches: the two dishonest empty states — a spinner that never resolves, and a
      // blank panel that a reader reads as "still loading". Rule 6: a state the user cannot
      // interpret is an error you never see.
      await expect(
        page.getByTestId(SEARCH_IDS.empty),
        `searching for "${NONSENSE_QUERY}" showed no explicit empty state (testID "${SEARCH_IDS.empty}")`,
      ).toBeVisible();
      await expect(
        page.getByTestId(searchResultId(0)),
        'a query with no matches still rendered a result row',
      ).toHaveCount(0);
    });

    await walkthrough.step('closing search returns to the chapter', async () => {
      await tap(page, SEARCH_IDS.close, "search's close control");

      await expect(page.getByTestId(SEARCH_IDS.root), 'search did not close').toBeHidden();
      await expect(
        page.getByTestId(READER_IDS.screen),
        'the reader is gone after closing search',
      ).toBeVisible();
    });
  });
});
