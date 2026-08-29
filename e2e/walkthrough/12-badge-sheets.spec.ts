/**
 * Chapter 12 — tapping each of the five badges.
 *
 * The journey
 *   Open Acts 16 and tap one pill of every kind in turn. For each: did a surface open, does
 *   it name the verse and word that was tapped, does it show the thing that kind exists to
 *   show, and does it carry its source and licence.
 *
 * Why the body is asserted and not just the chrome
 *   `AI-05` makes attribution non-optional, and the chrome carries it, so a sheet with only
 *   chrome passes an attribution check while being useless. The reason a reader taps
 *   `[Route]` is the map. `BADGE_BODY_IDS` names the one element each kind promises, and
 *   this chapter fails by name when it is missing — including when the component exists but
 *   nothing in the reader mounts it.
 *
 * Why every kind gets its own test rather than one loop
 *   Five separate tests produce five separate failures and five separate screenshot trails.
 *   A loop inside one test stops at the first missing body and reports the other four as
 *   unknown, which is the opposite of what an adversarial pass is for.
 *
 * Dependencies
 *   The walkthrough fixtures and the badge journeys.
 */

import {
  BADGE_BODY_IDS,
  BADGE_BODY_PROMISE,
  BADGE_KINDS,
  BADGE_SURFACE_IDS,
  badgeSourcesId,
  MURAI_ATTRIBUTION,
  type BadgeKindName,
} from '../support/badge-ids';
import {
  BADGE_CHAPTER_REFERENCE,
  badgeSurfaceOverflow,
  closeBadge,
  expectedBadgeHome,
  firstOfEachKind,
  inlineBadgeIds,
  openBadge,
  openBadgedChapter,
} from '../support/badge-journeys';
import { expect, test } from '../support/fixtures';
import type { Walkthrough } from '../support/steps';
import type { Page } from '@playwright/test';

/** Every licence the five M2 datasets ship under, as the attribution strip spells them. */
const LICENCE_PATTERN = /CC[\s-]?(BY|0)/i;

/**
 * Drive one kind end to end: open it, prove it says something real, prove it says who says so.
 *
 * @param page The page to drive.
 * @param walkthrough The step recorder.
 * @param kind Which of the five.
 */
async function walkOneBadge(
  page: Page,
  walkthrough: Walkthrough,
  kind: BadgeKindName,
): Promise<void> {
  let badgeId = '';

  await walkthrough.step(`find a ${kind} badge in ${BADGE_CHAPTER_REFERENCE}`, async () => {
    await openBadgedChapter(page);
    const found = firstOfEachKind(await inlineBadgeIds(page)).get(kind);
    expect(
      found,
      `${BADGE_CHAPTER_REFERENCE} has server data for ${kind}, but no pill of that kind ` +
        'is on screen, so the reader can never open it.',
    ).toBeDefined();
    badgeId = found ?? '';
  });

  await walkthrough.step(`tap the ${kind} pill`, async () => {
    const surface = await openBadge(page, badgeId, walkthrough.viewport);
    await expect(
      surface.getByTestId(BADGE_SURFACE_IDS.teaser),
      `the ${kind} surface opened with no claim in it`,
    ).toBeVisible();
  });

  await walkthrough.step(`the ${kind} sheet names its source and licence`, async () => {
    const sources = page.getByTestId(badgeSourcesId(badgeId));
    await expect(
      sources,
      `AI-05: every badge payload names its source and licence, and the UI displays it. ` +
        `The ${kind} sheet has no attribution strip, so this badge must not render at all.`,
    ).toBeVisible();
    const text = (await sources.innerText()).trim();
    expect(text.length, `the ${kind} attribution strip is empty`).toBeGreaterThan(0);
    expect(
      text,
      `the ${kind} attribution names no licence. "${text}" must say which one the data ` +
        'ships under, because Q-007 rests on the licence being known and honoured.',
    ).toMatch(LICENCE_PATTERN);
  });

  await walkthrough.step(`everything in the ${kind} sheet fits inside it`, async () => {
    const overflow = await badgeSurfaceOverflow(page, walkthrough.viewport);
    expect(
      overflow,
      `the ${kind} surface has content past its own right edge. An evidence chip is a ` +
        'single unbreakable line, so on a rail it is clipped mid-word and the citation ' +
        'the reader is meant to check becomes unreadable.',
    ).toEqual([]);
  });

  await walkthrough.step(`the ${kind} sheet shows ${BADGE_BODY_PROMISE[kind]}`, async () => {
    await expect(
      page.getByTestId(BADGE_BODY_IDS[kind]).first(),
      `the ${kind} sheet opened but does not contain ${BADGE_BODY_PROMISE[kind]} ` +
        `(testID "${BADGE_BODY_IDS[kind]}"). The reader tapped ${kind} and was shown a ` +
        'teaser and a source list — the same thing the chapter-end summary already said.',
    ).toBeVisible();
  });

  await walkthrough.step(`close the ${kind} sheet`, async () => {
    await closeBadge(page, walkthrough.viewport);
  });
}

test.describe('12 · badge sheets', () => {
  for (const kind of BADGE_KINDS) {
    test(`${kind} opens a sheet with real data and its attribution`, async ({
      page,
      walkthrough,
    }) => {
      await walkOneBadge(page, walkthrough, kind);
    });
  }

  test('the history sheet attributes Murai rather than stating his reading as fact', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step('open the history badge', async () => {
      await openBadgedChapter(page);
      const badgeId = firstOfEachKind(await inlineBadgeIds(page)).get('history');
      expect(badgeId, 'Acts 16 has a dated passage but no history pill').toBeDefined();
      await openBadge(page, badgeId ?? '', walkthrough.viewport);
    });

    await walkthrough.step(`the sheet says "${MURAI_ATTRIBUTION}"`, async () => {
      const surface = page.getByTestId(
        expectedBadgeHome(walkthrough.viewport) === 'rail'
          ? BADGE_SURFACE_IDS.rail
          : BADGE_SURFACE_IDS.sheet,
      );
      const text = await surface.innerText();
      expect(
        text,
        `Q-015: the passage title is one scholar's literary analysis and ships attributed ` +
          `inline as "${MURAI_ATTRIBUTION}". This sheet presents it as settled fact. ` +
          `The API already returns interpretive_claim="${MURAI_ATTRIBUTION}"; the UI drops it.`,
      ).toContain(MURAI_ATTRIBUTION);
    });
  });
});
