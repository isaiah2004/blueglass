/**
 * Chapter 16 — the canon outside Acts.
 *
 * The journey
 *   Four passages the previous fifteen chapters never open: Genesis 1, the chapter more
 *   people read than any other; Psalm 119, the longest in the Bible at 176 verses; Psalm
 *   117, the shortest at two; and Leviticus 13, which carries no enrichment at all. Each is
 *   opened, read to the end, and put through the standing audit at all three widths.
 *
 * Why this is not "more of the same"
 *   Chapters 1-15 drove Acts 16 and Acts 1 — one book, both chapters enriched, both about
 *   twenty-six verses long, both New Testament prose. Every layout question the reader can
 *   get wrong at a different scale was therefore unasked: a canvas that renders eagerly is
 *   indistinguishable from one that windows until a chapter is six times longer; chrome
 *   sized against a screenful of verses is indistinguishable from chrome that collapses
 *   until there are two; poetry's short lines break where prose does not.
 *
 * The table is verified before it is used
 *   The first test re-measures every passage against the live API. Without it, a hard-coded
 *   `verseCount` that drifted would turn a data regression into a green run, and the eight
 *   chapters that trust the table would each fail somewhere unrelated.
 *
 * Dependencies
 *   The walkthrough fixtures, the passage table, the API cross-check, and the M1 contract.
 */

import { inlineBadgeIds } from '../support/badge-journeys';
import { expect, test } from '../support/fixtures';
import { openReader, renderedVerseNumbers } from '../support/journeys';
import {
  GENESIS_1,
  LEVITICUS_13,
  PSALM_117,
  PSALM_119,
  WALKTHROUGH_PASSAGES,
  passagePath,
} from '../support/passages';
import { fetchChapter, fetchChapterBadges } from '../support/scripture-api';
import { READER_IDS, verseId } from '../support/test-ids';
import { verseProseText } from '../support/verse-prose';

/** The default translation the reader opens in, and the one the table was measured in. */
const DEFAULT_TRANSLATION = 'BSB';

test.describe('16 · the canon outside Acts', () => {
  test('every passage the walkthrough drives still holds the data it was chosen for', async ({
    viewportName,
    walkthrough,
  }) => {
    // The API's answer does not vary by viewport, so running this three times would only
    // triple the reads. It is skipped rather than moved into global setup on purpose: a
    // failure here must be one named test, not a crash that takes the whole run with it.
    test.skip(viewportName !== 'desktop', 'the corpus does not change with the window width');

    await walkthrough.step(
      're-measure the passage table against the live API',
      async () => {
        const drift: string[] = [];
        for (const passage of WALKTHROUGH_PASSAGES) {
          const [chapter, badges] = await Promise.all([
            fetchChapter(DEFAULT_TRANSLATION, passage.book, passage.chapter),
            fetchChapterBadges(DEFAULT_TRANSLATION, passage.book, passage.chapter),
          ]);
          if (chapter.verses.length !== passage.verseCount) {
            drift.push(
              `${passage.reference}: ${String(chapter.verses.length)} verses, table says ` +
                `${String(passage.verseCount)}`,
            );
          }
          if (badges.badges.length !== passage.badgeCount) {
            drift.push(
              `${passage.reference}: ${String(badges.badges.length)} badges, table says ` +
                `${String(passage.badgeCount)}`,
            );
          }
        }

        // Catches: a passage chosen for a property it no longer has — a re-ingest that lost
        // verses, or a selection-rule change that emptied a chapter this suite drives for
        // being full. Every chapter after this one reasons from these numbers, so finding
        // the drift here is one named failure instead of eight confusing ones.
        expect(
          drift,
          'e2e/support/passages.ts no longer describes the corpus. Re-measure it before ' +
            'trusting any chapter that reads from it.',
        ).toEqual([]);
      },
      { audit: false },
    );
  });

  test('Genesis 1 renders in full', async ({ page, walkthrough }) => {
    await walkthrough.step('open Genesis 1', async () => {
      await openReader(page, passagePath(GENESIS_1));
    });

    await walkthrough.step('all 31 verses are present, in order', async () => {
      const numbers = await renderedVerseNumbers(page);

      // Catches: a reader that only ever worked for the Acts plan. Genesis is book 1 and
      // Acts is book 44; a book-number lookup that happens to work for one and not the
      // other is exactly the class of bug DECISIONS.md §4 records the prototype shipping
      // (3 of 66 books mapped, the rest silently `book_number: 0`).
      expect(
        numbers.length,
        `Genesis 1 rendered ${String(numbers.length)} of ${String(GENESIS_1.verseCount)} verses`,
      ).toBe(GENESIS_1.verseCount);
      expect(numbers[0], 'Genesis 1 does not start at verse 1').toBe(1);
    });

    await walkthrough.step(
      'the text is Genesis, not a chapter the reader was left on',
      async () => {
        // The verse number is rendered inside the row and the `[Cross-Ref]` pill is spliced
        // into the sentence (`A-1`), so the comparison is a suffix rather than an equality.
        const text = await verseProseText(page, 1);

        // Catches: a stale query cache serving the previously-read chapter under the new
        // heading — the reader believes it is reading Genesis and is reading Acts. The API is
        // the arbiter, not a string in this file.
        const chapter = await fetchChapter(DEFAULT_TRANSLATION, GENESIS_1.book, GENESIS_1.chapter);
        const expected = (chapter.verses[0]?.text ?? '').replace(/\s+/g, ' ').trim();
        expect(
          text.endsWith(expected),
          `Genesis 1:1 reads "${text}" on screen; the API returned "${expected}"`,
        ).toBe(true);
      },
    );
  });

  test('Psalm 119 renders all 176 verses and scrolls to its end', async ({ page, walkthrough }) => {
    await walkthrough.step('open Psalm 119', async () => {
      await openReader(page, passagePath(PSALM_119));
    });

    await walkthrough.step('the longest chapter in the canon is complete', async () => {
      const numbers = await renderedVerseNumbers(page);

      // Catches: a canvas that truncates. Twenty-six verses fit inside almost any wrong
      // assumption — a fixed height, a `slice(0, 50)`, a paginator nobody finished — and
      // 176 fit inside none of them. This is the only chapter long enough to tell.
      expect(
        numbers.length,
        `Psalm 119 rendered ${String(numbers.length)} of 176 verses. Every chapter the ` +
          'suite drove before this one was short enough to hide a truncation.',
      ).toBe(PSALM_119.verseCount);
    });

    await walkthrough.step('the last verse can be reached and stays rendered', async () => {
      const last = page.getByTestId(verseId(PSALM_119.verseCount));
      await last.scrollIntoViewIfNeeded();
      await expect(last, 'Psalm 119:176 never became visible').toBeVisible();

      // Catches: a windowed list that unmounts the top of the chapter as the reader
      // descends and cannot restore it — a reader who scrolls down and back finds the psalm
      // has lost its opening. Also catches a footer pinned over the last verse.
      const numbers = await renderedVerseNumbers(page);
      expect(
        numbers.length,
        `after scrolling to the end, ${String(numbers.length)} verses remain rendered`,
      ).toBe(PSALM_119.verseCount);
      await expect(
        page.getByTestId(READER_IDS.attribution),
        'the attribution line is not reachable at the foot of a 176-verse chapter',
      ).toBeVisible();
    });
  });

  test('Psalm 117 reads as a chapter, not as chrome around two verses', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step('open Psalm 117', async () => {
      await openReader(page, passagePath(PSALM_117));
    });

    await walkthrough.step('both verses and the whole footer are on one screen', async () => {
      const numbers = await renderedVerseNumbers(page);

      // Catches: the opposite failure to Psalm 119's. With two verses there is nothing to
      // scroll, so every piece of fixed chrome — header, attribution, pager, tab bar — has
      // to fit the viewport at once or something is cut off. The standing audit measures
      // that; this step is what puts the reader in front of it.
      expect(numbers, 'Psalm 117 did not render exactly its two verses').toEqual([1, 2]);
      await expect(page.getByTestId(READER_IDS.attribution)).toBeVisible();
      await expect(page.getByTestId(READER_IDS.canvas)).toBeVisible();
    });
  });

  test('Leviticus 13 reads as plain scripture with nothing missing announced', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step('open Leviticus 13', async () => {
      await openReader(page, passagePath(LEVITICUS_13));
    });

    await walkthrough.step('a 59-verse chapter with no enrichment simply reads', async () => {
      const numbers = await renderedVerseNumbers(page);
      expect(numbers.length, `Leviticus 13 rendered ${String(numbers.length)} of 59 verses`).toBe(
        LEVITICUS_13.verseCount,
      );

      // Catches: pills rendered from a cache belonging to the last chapter. The API sends
      // nothing here, so anything on screen is the reader inventing enrichment — the
      // pillar-3 failure, in the chapter where it is easiest to see.
      expect(
        await inlineBadgeIds(page),
        'Leviticus 13 has no badges in the corpus, so a pill here is a claim with no source',
      ).toEqual([]);
    });
  });
});
