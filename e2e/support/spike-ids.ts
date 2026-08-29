/**
 * The two test ids the inline-badge spike screen publishes, and the wait before tapping.
 *
 * Purpose
 *   `inline-badge-spike.spec.ts` is the one spec outside `walkthrough/` that drives a real
 *   control, and it addressed it by a bare string in four places. Naming it here follows
 *   the same contract rule `support/test-ids.ts` sets for the product screens: the harness
 *   addresses elements by id, never by visible copy.
 *
 * Lifetime
 *   Delete this file together with the spike route and its spec, once the reader screen
 *   renders badges for real. See the spec's own header.
 *
 * Dependencies
 *   `./settle`, and `@playwright/test` for the page type.
 */

import type { Page } from '@playwright/test';

import { waitForSettled } from './settle';

/** The pressable pill inside the spike's line of scripture. */
export const TAP_BADGE = 'spike-tap-badge';

/** The line of scripture it sits in. */
export const TAP_LINE = 'spike-tap-line';

/** The counter that proves a tap landed. */
export const TAP_COUNT = 'spike-tap-count';

/**
 * Wait for the spike's pill to stop moving.
 *
 * @param page The page to drive.
 * @throws {Error} If the pill never reaches a stable box — see `./settle`.
 */
export async function waitForSettledBadge(page: Page): Promise<void> {
  await waitForSettled(page, TAP_BADGE, "the spike's tappable pill");
}
