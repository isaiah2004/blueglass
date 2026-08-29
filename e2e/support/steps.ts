/**
 * The walkthrough step recorder.
 *
 * Purpose
 *   A step is the unit this harness is built around: do one thing a reader would do, then
 *   photograph the result and review it. `walkthrough.step()` is what makes that automatic,
 *   so no chapter has to remember to screenshot, to audit the layout, or to check the
 *   console — and no chapter can quietly skip it.
 *
 * The evidence trail
 *   Every step writes `docs/qa/walkthroughs/<run>/<viewport>/<chapter>/<test>--NN-step.png`.
 *   The numbering is per test and monotonic, so the folder reads top to bottom as the
 *   journey happened, at each of the three widths, exactly as CLAUDE.md's walkthrough loop
 *   asks for.
 *
 * Why the screenshot is taken in a `finally`
 *   The most valuable frame in a run is the one where it broke. Photographing only on
 *   success would throw that frame away.
 *
 * Dependencies
 *   `@playwright/test`, the audit suite, the diagnostics watcher, and the run directory.
 */

import { basename, join } from 'node:path';

import { test as playwrightTest, type Page, type TestInfo } from '@playwright/test';

import { auditPage, type AuditOptions } from './audits';
import type { Diagnostics } from './diagnostics';
import { WALKTHROUGH_RUN_DIR } from './run-id';
import type { WalkthroughViewport } from './viewports';

/** How one step may vary from the standard treatment. */
export interface StepOptions {
  /** Capture the whole scroll height rather than the viewport. */
  readonly fullPage?: boolean;
  /** Audit tuning, or `false` to skip the standing audit for a deliberately odd state. */
  readonly audit?: AuditOptions | false;
}

/** What a chapter uses to walk the app. */
export interface Walkthrough {
  /** The viewport this test is running at. */
  readonly viewport: WalkthroughViewport;
  /** Absolute directory this test's screenshots are written to. */
  readonly screenshotDir: string;
  /** Perform one step, then photograph and review the result. */
  readonly step: (name: string, body: () => Promise<void>, options?: StepOptions) => Promise<void>;
  /** Photograph the current state without performing or auditing anything. */
  readonly shot: (name: string) => Promise<string>;
}

/** Everything the recorder needs to exist. */
export interface WalkthroughContext {
  readonly page: Page;
  readonly diagnostics: Diagnostics;
  readonly viewport: WalkthroughViewport;
  readonly testInfo: TestInfo;
}

/**
 * Reduce a title to a filename-safe slug.
 *
 * @param value Any human string.
 * @returns Lowercase, hyphen-separated, safe on every filesystem.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * The directory this test's screenshots belong in.
 *
 * @param viewport The viewport project.
 * @param testInfo The running test.
 * @returns An absolute path, one folder per chapter within one folder per viewport.
 */
function screenshotDirFor(viewport: WalkthroughViewport, testInfo: TestInfo): string {
  const chapter = basename(testInfo.file).replace(/\.spec\.ts$/, '');
  return join(WALKTHROUGH_RUN_DIR, viewport.name, chapter);
}

/**
 * Create the step recorder for one test.
 *
 * @param context The page, diagnostics, viewport and test metadata.
 * @returns The recorder the chapter drives.
 */
export function createWalkthrough(context: WalkthroughContext): Walkthrough {
  const { page, diagnostics, viewport, testInfo } = context;
  const screenshotDir = screenshotDirFor(viewport, testInfo);
  const testSlug = slugify(testInfo.title);
  let sequence = 0;

  const shot = async (name: string): Promise<string> => {
    sequence += 1;
    const ordinal = String(sequence).padStart(2, '0');
    const path = join(screenshotDir, `${testSlug}--${ordinal}-${slugify(name)}.png`);
    await page.screenshot({ path, animations: 'disabled' });
    return path;
  };

  const step = async (name: string, body: () => Promise<void>, options: StepOptions = {}) => {
    await playwrightTest.step(name, async () => {
      const label = `${viewport.name} / ${basename(testInfo.file)} / ${name}`;
      try {
        await body();
      } finally {
        sequence += 1;
        const ordinal = String(sequence).padStart(2, '0');
        await page.screenshot({
          path: join(screenshotDir, `${testSlug}--${ordinal}-${slugify(name)}.png`),
          fullPage: options.fullPage ?? false,
          animations: 'disabled',
        });
      }
      if (options.audit !== false) await auditPage(page, label, options.audit ?? {});
      diagnostics.assertClean(label);
    });
  };

  return { viewport, screenshotDir, step, shot };
}
