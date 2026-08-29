/**
 * Chapter 18 — all four translations, not just the default.
 *
 * The journey
 *   Open one Old Testament chapter and one New Testament chapter, and read each of them in
 *   BSB, KJV, WEB and ASV in turn — comparing every verse on screen against what the API
 *   returned for that translation, and every badge against the anchor that translation's
 *   badge endpoint declared.
 *
 * What chapter 4 already covers, and what it does not
 *   Chapter 4 proves the switcher lists four translations, offers no licensed one, and that
 *   the words change when KJV is chosen. It never opens WEB or ASV, never leaves Acts, and
 *   never checks that the words that changed are the **right** words. A reader served the
 *   BSB text under a KJV label passes every assertion in chapter 4.
 *
 * The pillar-3 half
 *   Badge anchors are byte offsets into the verse text **of one translation**, recomputed
 *   per translation by the API. A reader that fetches scripture per translation but keeps
 *   the badges it already had anchors every pill in the chapter to whatever word now sits
 *   at that offset. Nothing errors; a `[Route]` pill simply attaches to the wrong word and
 *   asserts, with a citation, something the text does not say. `probeBadgeAnchors` is the
 *   only check in this suite that can see it.
 *
 * Why it runs at desktop width only
 *   It reads two chapters four times each and compares every verse; the comparison is text,
 *   not layout, and does not change with the window. Chapters 14 and 15 own the badge
 *   surfaces at each width.
 *
 * Dependencies
 *   The walkthrough fixtures, the passage table, the API cross-check, the anchor probe.
 */

import { probeBadgeAnchors, unsourcedBadgeIds } from '../support/anchor-integrity';
import { inlineBadgeIds } from '../support/badge-journeys';
import { formatFindings } from '../support/findings';
import { expect, test } from '../support/fixtures';
import { openReader, renderedVerseNumbers, tap } from '../support/journeys';
import { ALL_TRANSLATIONS, JOHN_3, PSALM_119, passagePath } from '../support/passages';
import type { WalkthroughPassage } from '../support/passages';
import {
  anchorTextByBadgeId,
  fetchChapter,
  fetchChapterBadges,
  verseTextByNumber,
} from '../support/scripture-api';
import { READER_IDS, TRANSLATION_IDS, translationOptionId } from '../support/test-ids';
import { verseProseText } from '../support/verse-prose';
import type { Page } from '@playwright/test';

/** How many verses of a long chapter are compared verbatim, evenly across the chapter. */
const SAMPLED_VERSES = 6;

/**
 * Switch the reader to a translation and wait for the sheet to close behind it.
 *
 * @param page The page to drive.
 * @param code The translation code.
 */
async function chooseTranslation(page: Page, code: string): Promise<void> {
  await tap(page, TRANSLATION_IDS.switcher, 'the translation switcher');
  await tap(page, translationOptionId(code), `the ${code} option`);
  await expect(
    page.getByTestId(TRANSLATION_IDS.menu),
    `the switcher stayed open over the scripture after choosing ${code} (pillar 1)`,
  ).toBeHidden();
}

/**
 * Which verse numbers to compare, spread across the chapter rather than bunched at the top.
 *
 * @param verseCount How many verses the chapter has.
 * @returns Up to {@link SAMPLED_VERSES} verse numbers, always including the first and last.
 */
function sampleVerses(verseCount: number): number[] {
  if (verseCount <= SAMPLED_VERSES) {
    return Array.from({ length: verseCount }, (_unused, index) => index + 1);
  }
  const step = (verseCount - 1) / (SAMPLED_VERSES - 1);
  const sampled = new Set<number>();
  for (let index = 0; index < SAMPLED_VERSES; index += 1) {
    sampled.add(Math.round(1 + index * step));
  }
  return [...sampled].sort((a, b) => a - b);
}

test.describe('18 · all four translations', () => {
  test.skip(
    ({ viewportName }) => viewportName !== 'desktop',
    'this chapter compares text against the API; the comparison does not vary with width',
  );

  for (const passage of [PSALM_119, JOHN_3] satisfies WalkthroughPassage[]) {
    test(`${passage.reference} reads correctly in every shipped translation`, async ({
      page,
      walkthrough,
    }) => {
      await walkthrough.step(`open ${passage.reference}`, async () => {
        await openReader(page, passagePath(passage));
      });

      for (const code of ALL_TRANSLATIONS) {
        await walkthrough.step(`read ${passage.reference} in ${code}`, async () => {
          await chooseTranslation(page, code);
          const chapter = await fetchChapter(code, passage.book, passage.chapter);
          const expected = verseTextByNumber(chapter);

          // Catches: a translation change that repaints the label and reuses the cached
          // text of the previous one. Comparing against the API for THIS code is the only
          // way to tell the two apart — both render fluent English scripture, and both look
          // entirely correct in a screenshot.
          const wrong: string[] = [];
          for (const verse of sampleVerses(passage.verseCount)) {
            const onScreen = await verseProseText(page, verse);
            const fromApi = expected.get(verse) ?? '';
            if (!onScreen.endsWith(fromApi)) {
              wrong.push(
                `v${String(verse)}: screen "${onScreen.slice(-60)}" vs API "${fromApi.slice(-60)}"`,
              );
            }
          }
          expect(
            wrong,
            `${passage.reference} is labelled ${code} but does not show the ${code} text`,
          ).toEqual([]);

          // Catches: a translation whose ingest is partial. Every open translation holds the
          // same versification here, so a short chapter in one of them is missing data
          // rather than a different edition.
          expect(
            (await renderedVerseNumbers(page)).length,
            `${passage.reference} in ${code} rendered the wrong number of verses`,
          ).toBe(passage.verseCount);

          // Catches: an attribution line that keeps naming the translation the reader left.
          // It is the one place the app states, in words, which text this is — the licence
          // obligation and the reader's trust rest on the same line.
          await expect(
            page.getByTestId(READER_IDS.attribution),
            `the attribution names neither ${code} nor its title after switching to it`,
          ).not.toBeEmpty();
        });
      }
    });
  }

  test('badges stay anchored to their own words in every translation', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step(`open ${JOHN_3.reference}`, async () => {
      await openReader(page, passagePath(JOHN_3));
    });

    for (const code of ALL_TRANSLATIONS) {
      await walkthrough.step(`check every pill in ${JOHN_3.reference} · ${code}`, async () => {
        await chooseTranslation(page, code);
        const badges = await fetchChapterBadges(code, JOHN_3.book, JOHN_3.chapter);
        const anchors = anchorTextByBadgeId(badges);

        await expect
          .poll(
            async () => (await inlineBadgeIds(page)).length,
            `${JOHN_3.reference} rendered no pills in ${code}, though the API sent ` +
              `${String(badges.badges.length)}`,
          )
          .toBeGreaterThan(0);
        const rendered = await inlineBadgeIds(page);

        // Catches: enrichment kept across a translation change. A badge the server did not
        // send for this translation is a claim with no source behind it at all — the exact
        // state AI-05 forbids, arriving through a cache rather than through a bad payload.
        expect(
          unsourcedBadgeIds(rendered, anchors),
          `these pills are on screen in ${code} but the ${code} badge endpoint never sent ` +
            'them. They are enrichment left over from another translation.',
        ).toEqual([]);

        // Catches: the pillar-3 failure this chapter exists for. Offsets are per
        // translation; a pill rendered at another translation's offset attaches to the
        // wrong word and asserts, with a correct-looking citation, something the text in
        // front of the reader does not say.
        const findings = await probeBadgeAnchors(page, anchors);
        expect(
          findings,
          formatFindings(`badge anchors — ${JOHN_3.reference} in ${code}`, findings),
        ).toEqual([]);
      });
    }
  });
});
