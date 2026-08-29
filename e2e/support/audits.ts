/**
 * The standing audit — what is checked on every screen, at every step.
 *
 * Purpose
 *   A walkthrough that only asked "is the expected text present" would pass on a screen
 *   with a sideways scrollbar, 32 px tab targets and unreadable metadata. These audits are
 *   what turns each step from a smoke test into a review. They run after every step of
 *   every chapter, so a regression introduced anywhere is caught at the first screen that
 *   shows it rather than at the one screen someone thought to check.
 *
 * Every assertion states the bug it catches
 *   That is the standard for this harness: an assertion that cannot fail is noise. The
 *   specific failure each probe exists to catch is documented on the probe itself in
 *   `probes-layout.ts` and `probes-text.ts`; this module composes them and owns the
 *   thresholds.
 *
 * What is deliberately not audited here
 *   Colour contrast. It is already locked at the token level by
 *   `apps/mobile/src/theme/colors.contrast.test.ts`, which measures every legal pairing
 *   against WCAG AA (`Q-017`). Re-deriving ratios from screenshots would be less accurate
 *   and would fail for reasons the design system has already settled.
 *
 * Dependencies
 *   `@playwright/test` for `expect`, plus the probes and the shared `Finding` shape.
 */

import { expect, type Page } from '@playwright/test';

import { formatFindings, type Finding } from './findings';
import {
  probeClippedText,
  probeDocumentOverflow,
  probeOverhangingElements,
  probeOverlappingText,
  probeTextBelowViewport,
} from './probes-layout';
import {
  isFontLoaded,
  probeIllegibleText,
  probeSmallTapTargets,
  textFontFamily,
} from './probes-text';
import { MIN_TAP_TARGET_PX } from './viewports';

/**
 * The smallest font size treated as legible.
 *
 * Set to the floor of the design system's own scale, not to a number this harness liked.
 * `design-language.md` §3 puts metadata at 9–11 pt and `typography.ts` encodes exactly
 * that (`metadataSize = { xs: 9, sm: 10, md: 11 }`), so 9 px is a deliberate step and
 * anything below it is an accident.
 *
 * An earlier draft used 11 px and reported every uppercase label in the app. That is the
 * failure mode this constant exists to avoid: an audit that contradicts the project's own
 * design language is not a high bar, it is noise, and noise is how a walkthrough stops
 * being read. Legibility at 9 pt is a contrast question, and contrast is already locked by
 * `apps/mobile/src/theme/colors.contrast.test.ts` (`Q-017`).
 */
const MIN_LEGIBLE_FONT_PX = 9;

/**
 * The scripture face `D-03` chose, as `expo-font` actually registers it.
 *
 * The family in the DOM is the *face* name — `SourceSerif4-Regular`,
 * `SourceSerif4-SemiBold` — not the human name "Source Serif 4", because React Native
 * registers one family per family-and-weight pair (`apps/mobile/src/theme/typography.ts`).
 * Matching the shared prefix therefore checks the right thing at every weight.
 */
export const SCRIPTURE_FONT_FAMILY = 'SourceSerif4';

/**
 * Run every layout probe and fail with all findings at once.
 *
 * Reporting them together matters: a single sideways-scrolling page usually produces one
 * document finding and several element findings, and the element findings are what name
 * the culprit. Failing on the first would hide the useful half.
 *
 * @param page The page to audit.
 * @param label Where this audit is happening, e.g. `desktop / reader / after translation change`.
 */
export async function expectCleanLayout(page: Page, label: string): Promise<void> {
  const findings: Finding[] = [
    ...(await probeDocumentOverflow(page)),
    ...(await probeOverhangingElements(page)),
    ...(await probeClippedText(page)),
    ...(await probeTextBelowViewport(page)),
    ...(await probeOverlappingText(page)),
  ];
  expect(findings, formatFindings(`layout audit — ${label}`, findings)).toEqual([]);
}

/**
 * Fail if any pressable control is below the minimum tap target.
 *
 * @param page The page to audit.
 * @param label Where this audit is happening.
 * @param minimumPx Override the default minimum. Defaults to {@link MIN_TAP_TARGET_PX}.
 */
export async function expectTapTargets(
  page: Page,
  label: string,
  minimumPx: number = MIN_TAP_TARGET_PX,
): Promise<void> {
  const findings = await probeSmallTapTargets(page, minimumPx);
  expect(findings, formatFindings(`tap-target audit — ${label}`, findings)).toEqual([]);
}

/**
 * Fail if any visible text is too small or painted at zero alpha.
 *
 * @param page The page to audit.
 * @param label Where this audit is happening.
 */
export async function expectLegibleText(page: Page, label: string): Promise<void> {
  const findings = await probeIllegibleText(page, MIN_LEGIBLE_FONT_PX);
  expect(findings, formatFindings(`legibility audit — ${label}`, findings)).toEqual([]);
}

/**
 * Assert that scripture is rendered in the scripture serif, and that the serif is real.
 *
 * Catches two distinct bugs with one call. First: a verse component that reached for a UI
 * token instead of `scriptureText()`, so the canvas renders in Inter — the one thing
 * `typography.ts` calls non-negotiable. Second, and more insidious: the token is correct
 * but no `.ttf` was ever bundled, so every platform silently substitutes a system face and
 * the reader ships in Segoe UI while the code says Source Serif 4.
 *
 * @param page The page the verse belongs to.
 * @param verseTestId The test id of one rendered verse.
 * @param label Where this audit is happening.
 */
export async function expectScriptureSerif(
  page: Page,
  verseTestId: string,
  label: string,
): Promise<void> {
  const family = await textFontFamily(page, verseTestId);
  expect(
    family,
    `scripture font — ${label}: the verse resolves to "${family}", which does not name ${SCRIPTURE_FONT_FAMILY}. ` +
      'Scripture is always the serif (apps/mobile/src/theme/typography.ts).',
  ).toContain(SCRIPTURE_FONT_FAMILY);

  const loaded = await isFontLoaded(page, SCRIPTURE_FONT_FAMILY);
  expect(
    loaded,
    `scripture font — ${label}: the style names ${SCRIPTURE_FONT_FAMILY} but no face with that family is loaded, ` +
      'so the browser is substituting. Bundle the .ttf and register it through expo-font.',
  ).toBe(true);
}

/** Which audits to run for one step. */
export interface AuditOptions {
  /** Skip the tap-target audit — for a step that is mid-animation or mid-drag. */
  readonly skipTapTargets?: boolean;
  /** Override the tap-target minimum. */
  readonly minTapTargetPx?: number;
}

/**
 * The standing audit: layout, tap targets, legibility.
 *
 * @param page The page to audit.
 * @param label Where this audit is happening.
 * @param options Which audits to run.
 */
export async function auditPage(
  page: Page,
  label: string,
  options: AuditOptions = {},
): Promise<void> {
  await expectCleanLayout(page, label);
  await expectLegibleText(page, label);
  if (options.skipTapTargets !== true) {
    await expectTapTargets(page, label, options.minTapTargetPx ?? MIN_TAP_TARGET_PX);
  }
}
