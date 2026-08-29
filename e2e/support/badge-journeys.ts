/**
 * The shared moves of the badge chapters, and the passages they agree on.
 *
 * Purpose
 *   Four chapters all need to open a chapter that has badges, read which pills are on
 *   screen, tap one, and find the surface it opened into. Written out four times those
 *   moves drift, and the suite starts failing for harness reasons rather than app ones.
 *   They live here once, the same way `journeys.ts` holds M1's.
 *
 * Why the surface is chosen by width and not by trying both
 *   `Q-006`: below 600 dp a tapped badge opens a half sheet; at and above it, the badge
 *   fills the context rail. `ReaderScreen` makes that choice from the same rule the layout
 *   uses, so the two can never both be showing one badge. A helper that accepted either
 *   would pass on a phone that wrongly grew a rail, which is precisely the bug the
 *   breakpoints exist to prevent.
 *
 * The passages are chosen, not convenient
 *   Acts 16 is the MVP's own chapter and the only one that carries all five kinds at once.
 *   Leviticus 13 was measured to carry none — the honest-empty case. Both are asserted
 *   against the live API by chapter 11 before anything is concluded from them.
 *
 * Dependencies
 *   `@playwright/test`, the M1 journeys, and the M2 test-id contract.
 */

import { expect, type Locator, type Page } from '@playwright/test';

import {
  BADGE_KINDS,
  BADGE_SURFACE_IDS,
  INLINE_BADGE_PREFIX,
  type BadgeKindName,
} from './badge-ids';
import { openReader } from './journeys';
import { waitForSettled } from './settle';
import { RAIL_BREAKPOINT_PX, type WalkthroughViewport } from './viewports';

/** The chapter the whole milestone is specified against: all five kinds, one screen. */
export const BADGE_CHAPTER_PATH = '/read/acts/16';

/** Its human reference, for failure messages. */
export const BADGE_CHAPTER_REFERENCE = 'Acts 16';

/**
 * A chapter measured to carry no badges at all.
 *
 * Leviticus 13 is a long chapter with no place names, no dated event, no Greek root and no
 * cross-reference strong enough to select. It is the state the reader spends most of the
 * canon in, so a walkthrough that only ever drove Acts 16 would never see it.
 */
export const BADGELESS_CHAPTER_PATH = '/read/leviticus/13';

/** Its human reference. */
export const BADGELESS_CHAPTER_REFERENCE = 'Leviticus 13';

/** How few pills would mean Acts 16's enrichment did not really arrive. */
export const MIN_BADGES_IN_ACTS_16 = 5;

/**
 * Open a chapter and wait for its pills to arrive.
 *
 * Enrichment is a second request, deliberately not merged with the chapter read, so the
 * scripture is on screen before the badges are. Waiting for the first pill rather than for
 * a timeout is what stops this being flaky on a cold Metro build.
 *
 * @param page The page to drive.
 * @param path Which chapter. Defaults to Acts 16.
 * @returns The reader screen locator.
 */
export async function openBadgedChapter(
  page: Page,
  path: string = BADGE_CHAPTER_PATH,
): Promise<Locator> {
  const reader = await openReader(page, path);
  await expect(
    page.locator(`[data-testid^="${INLINE_BADGE_PREFIX}"]`).first(),
    `no inline badge ever appeared in ${path}. Scripture rendered, so this is the ` +
      'enrichment request failing or the pills never being spliced into the verse.',
  ).toBeAttached({ timeout: 30_000 });
  return reader;
}

/**
 * Every badge id the reader currently has a pill for, in DOM order.
 *
 * Asks the DOM rather than the API: what matters is what the reader can tap.
 *
 * @param page The page to query.
 * @returns The server badge ids, e.g. `route~44016001~chapter:Acts.16`.
 */
export async function inlineBadgeIds(page: Page): Promise<string[]> {
  return page.evaluate(
    (prefix: string) =>
      Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`))
        .map((element) => (element.getAttribute('data-testid') ?? '').slice(prefix.length))
        .filter((value) => value.length > 0),
    INLINE_BADGE_PREFIX,
  );
}

/**
 * The kind a badge id declares.
 *
 * The id is `kind~verseKey~discriminator`, which the API documents on its own path
 * parameter, so the kind is readable without a second request.
 *
 * @param badgeId A server badge id.
 * @returns The kind, or `undefined` when the id does not name one of the five.
 */
export function badgeKindOf(badgeId: string): BadgeKindName | undefined {
  const head = badgeId.split('~')[0];
  return BADGE_KINDS.find((kind) => kind === head);
}

/**
 * One badge id per kind, taking the first of each in reading order.
 *
 * @param badgeIds Every id on screen.
 * @returns A map from kind to the first badge of that kind.
 */
export function firstOfEachKind(badgeIds: readonly string[]): Map<BadgeKindName, string> {
  const found = new Map<BadgeKindName, string>();
  for (const badgeId of badgeIds) {
    const kind = badgeKindOf(badgeId);
    if (kind !== undefined && !found.has(kind)) found.set(kind, badgeId);
  }
  return found;
}

/**
 * Which home an opened badge belongs in at this width.
 *
 * @param viewport The viewport under test.
 * @returns `rail` at and above 600 dp, `sheet` below it.
 */
export function expectedBadgeHome(viewport: WalkthroughViewport): 'rail' | 'sheet' {
  return viewport.width >= RAIL_BREAKPOINT_PX ? 'rail' : 'sheet';
}

/**
 * The surface a badge should have opened into at this width.
 *
 * @param page The page to query.
 * @param viewport The viewport under test.
 * @returns A locator for the sheet or the rail panel.
 */
export function badgeSurface(page: Page, viewport: WalkthroughViewport): Locator {
  return page.getByTestId(
    expectedBadgeHome(viewport) === 'rail' ? BADGE_SURFACE_IDS.rail : BADGE_SURFACE_IDS.sheet,
  );
}

/**
 * Tap one pill and wait for its surface.
 *
 * @param page The page to drive.
 * @param badgeId Which badge.
 * @param viewport The viewport under test.
 * @returns The opened surface.
 */
export async function openBadge(
  page: Page,
  badgeId: string,
  viewport: WalkthroughViewport,
): Promise<Locator> {
  const testId = `${INLINE_BADGE_PREFIX}${badgeId}`;
  const pill = page.getByTestId(testId);
  await pill.scrollIntoViewIfNeeded();
  await expect(
    pill,
    `the pill for ${badgeId} is not on screen, so it cannot be tapped`,
  ).toBeVisible();
  // The chapter's badges arrive after the scripture and splice into the verses, so the
  // column reflows around them. Settling first keeps the click's own 15 s budget for the
  // click rather than for a cold bundle — `support/settle.ts` has the measurements.
  await waitForSettled(page, testId, `the pill for ${badgeId}`);
  await pill.click();

  const surface = badgeSurface(page, viewport);
  await expect(
    surface,
    `tapping ${badgeId} at ${viewport.name} width opened no ${expectedBadgeHome(viewport)}. ` +
      `${viewport.regime}.`,
  ).toBeVisible();
  return surface;
}

/** One element that does not fit inside the badge surface that contains it. */
export interface SurfaceOverflow {
  /** The element's text, truncated — enough to identify it in the design. */
  readonly text: string;
  /** How many pixels past the surface's right edge it reaches. */
  readonly overflowPx: number;
}

/**
 * Which elements inside the open badge surface reach past its own right edge.
 *
 * The standing audit measures against the viewport, which is the right question for a
 * full-width screen and the wrong one for a 290 px rail: a chip that runs 400 px past the
 * rail is clipped by an ancestor long before the page would scroll, so the reader sees a
 * sentence cut mid-word and the page looks fine. Measuring against the container is what
 * catches it.
 *
 * SVG internals are excluded, and that is not a loosening
 *   `getBoundingClientRect` on an SVG child returns its GEOMETRY, not what is painted. The
 *   drawn map projects the whole Mediterranean coastline and then relies on the `<svg>`
 *   root's own `overflow: hidden` to show only the frame — by design (`M-01`: one
 *   `fill-rule: evenodd` path for all 127 rings, culled but not trimmed). So the coastline
 *   path measures ~970 px wide inside a 375 px sheet while being clipped to the sheet, and
 *   reporting it drowned the real finding: it was the ONLY entry left once the evidence
 *   chips were fixed, so a genuine chip regression would have arrived as one more line in a
 *   list already treated as noise. The `<svg>` element itself is still measured, so a map
 *   that really is too wide for its container is still caught.
 *
 * @param page The page to query.
 * @param viewport The viewport under test, which decides which surface is open.
 * @returns One entry per overflowing element, worst first.
 */
export async function badgeSurfaceOverflow(
  page: Page,
  viewport: WalkthroughViewport,
): Promise<SurfaceOverflow[]> {
  const testId =
    expectedBadgeHome(viewport) === 'rail' ? BADGE_SURFACE_IDS.rail : BADGE_SURFACE_IDS.sheet;
  return page.evaluate((surfaceTestId: string) => {
    const surface = document.querySelector(`[data-testid="${surfaceTestId}"]`);
    if (surface === null) return [];
    const bounds = surface.getBoundingClientRect();
    const found: { text: string; overflowPx: number }[] = [];
    // Inside an <svg>: clipped by the SVG root, whose own box is still measured.
    const insideSvg = (element: Element): boolean => {
      for (let node = element.parentElement; node !== null; node = node.parentElement) {
        if (node.tagName.toLowerCase() === 'svg') return true;
      }
      return false;
    };
    for (const element of surface.querySelectorAll('*')) {
      if (insideSvg(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const overflowPx = Math.round(rect.right - bounds.right);
      if (overflowPx <= 1) continue;
      found.push({ text: (element.textContent ?? '').trim().slice(0, 60), overflowPx });
    }
    return found.sort((a, b) => b.overflowPx - a.overflowPx).slice(0, 6);
  }, testId);
}

/**
 * Close whichever badge home is open.
 *
 * @param page The page to drive.
 * @param viewport The viewport under test.
 */
export async function closeBadge(page: Page, viewport: WalkthroughViewport): Promise<void> {
  if (expectedBadgeHome(viewport) === 'rail') {
    await page.getByTestId(BADGE_SURFACE_IDS.railClose).click();
  } else {
    await page
      .getByRole('button', { name: /^Close / })
      .first()
      .click();
  }
  await expect(badgeSurface(page, viewport)).toBeHidden();
}
