/**
 * Chapter 21 — a chapter at the badge cap, and one with none, side by side.
 *
 * The journey
 *   Open John 3, which the selection rules fill to the brim — twelve badges, the chapter
 *   maximum, over ten verses, with two of those verses carrying the per-verse maximum — and
 *   ask what the reader actually receives: are the caps honoured on screen, is every pill
 *   distinct, does each one sit against the word it names, and does a verse carrying two
 *   pills still read as a line of poetry rather than a toolbar.
 *
 * Why not Acts 16
 *   Acts 16 is equally dense and is what the milestone was tuned against, so it is the one
 *   chapter where a cap could be satisfied by coincidence. John 3 reaches the same density
 *   from a different mix — no `[Route]`-heavy itinerary, two `[History]` datings, four
 *   Greek roots — which is what makes it evidence rather than a repeat.
 *
 * The caps are the app's promise, not this file's opinion
 *   `apps/api/.../badges/domain/selection.py` fixes them: `MAX_BADGES_PER_VERSE = 2`,
 *   `MAX_BADGES_PER_CHAPTER = 12`. They exist so scripture stays readable. A reader that
 *   renders more than the server sent — by merging two responses, or by keeping the
 *   previous chapter's pills — breaks the promise without the server ever being wrong,
 *   and the caps are the only place that is visible.
 *
 * Dependencies
 *   The walkthrough fixtures, the badge journeys, the passage table, the API cross-check.
 */

import { probeBadgeAnchors, unsourcedBadgeIds } from '../support/anchor-integrity';
import { INLINE_BADGE_PREFIX } from '../support/badge-ids';
import { inlineBadgeIds, openBadgedChapter } from '../support/badge-journeys';
import { formatFindings } from '../support/findings';
import { expect, test } from '../support/fixtures';
import { renderedVerseNumbers } from '../support/journeys';
import { JOHN_3, passagePath } from '../support/passages';
import { anchorTextByBadgeId, fetchChapterBadges } from '../support/scripture-api';

/** `MAX_BADGES_PER_VERSE` in `apps/api/app/modules/badges/domain/selection.py`. */
const MAX_BADGES_PER_VERSE = 2;

/** `MAX_BADGES_PER_CHAPTER` in the same module. */
const MAX_BADGES_PER_CHAPTER = 12;

/** The translation the badge cap was measured in. */
const TRANSLATION = 'BSB';

test.describe('21 · a chapter at the badge cap', () => {
  test('John 3 renders every badge the server sent, and not one more', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step(`open ${JOHN_3.reference}`, async () => {
      await openBadgedChapter(page, passagePath(JOHN_3));
      expect(
        (await renderedVerseNumbers(page)).length,
        `${JOHN_3.reference} did not render its ${String(JOHN_3.verseCount)} verses`,
      ).toBe(JOHN_3.verseCount);
    });

    await walkthrough.step('the chapter cap is honoured on screen', async () => {
      // Re-read from the DOM rather than reusing the previous step's list: each step is a
      // fresh measurement, so a chapter that grows pills after its first paint is caught.
      const rendered = await inlineBadgeIds(page);

      // Catches: two enrichment responses merged instead of replaced — the shape a
      // refetch-on-focus or a translation change takes when the cache key is too coarse.
      // The chapter would then carry 24 pills, every one of them individually correct.
      expect(
        rendered.length,
        `${JOHN_3.reference} shows ${String(rendered.length)} pills. The server selects at ` +
          `most ${String(MAX_BADGES_PER_CHAPTER)}, so anything above that is the client ` +
          'adding badges the reader was never sent.',
      ).toBeLessThanOrEqual(MAX_BADGES_PER_CHAPTER);
      expect(
        rendered.length,
        `${JOHN_3.reference} was measured at ${String(JOHN_3.badgeCount)} badges`,
      ).toBe(JOHN_3.badgeCount);
    });

    await walkthrough.step('no badge is rendered twice', async () => {
      const rendered = await inlineBadgeIds(page);

      // Catches: a list keyed by index rather than by badge id, and a splice that runs the
      // anchor set once per re-render. A duplicated pill is two pills that open the same
      // sheet — the reader reads it as two separate pieces of evidence for one claim.
      const duplicates = rendered.filter((id, index) => rendered.indexOf(id) !== index);
      expect(
        duplicates,
        `these badge ids are rendered more than once: ${duplicates.join(', ')}`,
      ).toEqual([]);
    });

    await walkthrough.step('no verse carries more than two pills', async () => {
      const overloaded = await page.evaluate((prefix: string) => {
        const perVerse = new Map<string, number>();
        for (const pill of document.querySelectorAll(`[data-testid^="${prefix}"]`)) {
          const verse = pill.closest('[data-testid^="verse-row-"]');
          if (verse === null) continue;
          const id = verse.getAttribute('data-testid') ?? '?';
          perVerse.set(id, (perVerse.get(id) ?? 0) + 1);
        }
        return [...perVerse]
          .filter(([, count]) => count > 2)
          .map(([id, count]) => `${id}: ${String(count)}`);
      }, INLINE_BADGE_PREFIX);

      // Catches: the per-verse rule applied on the server and then undone on the client by
      // rendering every anchor a verse has rather than the ones selection kept. Three pills
      // in one line of scripture is the point where the canvas stops being a reading canvas
      // (pillar 1), and John 3 is the only chapter dense enough for it to show.
      expect(
        overloaded,
        `selection.py caps a verse at ${String(MAX_BADGES_PER_VERSE)} badges. These verses ` +
          'carry more, so the reader is seeing candidates rather than selections.',
      ).toEqual([]);
    });
  });

  test('every pill in John 3 names the word it sits against', async ({ page, walkthrough }) => {
    await walkthrough.step(`open ${JOHN_3.reference} and read its anchors`, async () => {
      await openBadgedChapter(page, passagePath(JOHN_3));
      const badges = await fetchChapterBadges(TRANSLATION, JOHN_3.book, JOHN_3.chapter);
      const anchors = anchorTextByBadgeId(badges);
      const rendered = await inlineBadgeIds(page);

      // Catches: a pill with no server badge behind it — the state AI-05 forbids outright.
      expect(
        unsourcedBadgeIds(rendered, anchors),
        `these pills are on screen in ${JOHN_3.reference} but the badge endpoint never sent them`,
      ).toEqual([]);

      // Catches: an off-by-one in the splice. `segmentVerse` cuts the verse at the anchor's
      // offsets; a single character of drift moves every pill in the chapter one word left,
      // so `[Root]` on "born" reads as `[Root]` on "again". Every pill still opens, every
      // sheet still cites its lexicon, and every claim is now about the wrong word. Under
      // twelve badges the drift is twelve wrong claims on one screen.
      const findings = await probeBadgeAnchors(page, anchors);
      expect(
        findings,
        formatFindings(`badge anchors — ${JOHN_3.reference} at the cap`, findings),
      ).toEqual([]);
    });
  });

  test('a doubly-badged verse still reads as one line of scripture', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step(`open ${JOHN_3.reference}`, async () => {
      await openBadgedChapter(page, passagePath(JOHN_3));
    });

    await walkthrough.step('the verse carrying two pills keeps its line rhythm', async () => {
      const broken = await page.evaluate((prefix: string) => {
        const problems: string[] = [];
        const byVerse = new Map<Element, Element[]>();
        for (const pill of document.querySelectorAll(`[data-testid^="${prefix}"]`)) {
          const verse = pill.closest('[data-testid^="verse-row-"]');
          if (verse === null) continue;
          byVerse.set(verse, [...(byVerse.get(verse) ?? []), pill]);
        }
        for (const [verse, pills] of byVerse) {
          if (pills.length < 2) continue;
          const leading = Number.parseFloat(getComputedStyle(verse).lineHeight);
          if (!Number.isFinite(leading) || leading <= 0) continue;
          for (const pill of pills) {
            const height = pill.getBoundingClientRect().height;
            if (height > leading) {
              problems.push(
                `${verse.getAttribute('data-testid') ?? '?'} carries a ${height.toFixed(1)}px ` +
                  `pill in a ${leading.toFixed(1)}px line`,
              );
            }
          }
        }
        return problems;
      }, INLINE_BADGE_PREFIX);

      // Catches: pills that fit one to a line and stop fitting when a verse has two. Chapter
      // 11 measures the same thing on Acts 16, where the doubled verses are prose; John 3's
      // doubled verses are the ones a reader quotes, and a line that opens up around its
      // badges is visible there in a way it is not in a narrative paragraph.
      expect(
        broken,
        'design-language.md §5: badges must not disturb the scripture line rhythm, and a ' +
          'verse at the per-verse cap is where that is hardest.',
      ).toEqual([]);
    });
  });
});
