/**
 * The two numbers that shape the column of scripture.
 *
 * Purpose
 *   `@/theme`'s `breakpoints` module already owns the reading *measure* per form factor —
 *   how wide a line of the serif may run. What it does not own is the gutter beside it,
 *   because that is a reading-canvas decision rather than a shell one. This module is that
 *   decision, kept pure so both numbers can be asserted without rendering.
 *
 * Why the gutter grows and the measure does not
 *   Widening the measure on a large screen makes lines longer and harder to read; widening
 *   the gutter makes the same column sit in more air, which is what a large screen is
 *   actually for. The measure is therefore capped by the design system and the gutter is
 *   the only thing that scales.
 *
 * The pane is not the window, and that was a real defect
 *   `readerGutterFor` and `scriptureStepByFormFactor` were both asked about the *window*.
 *   On a 768 dp tablet the window is a tablet and the reading pane is not: 80 dp of nav
 *   rail and a 280 dp context rail leave 408 dp, and a tablet gutter and tablet type inside
 *   it produced a 306 dp column — **narrower than the same app's phone column, in larger
 *   type**, at about 28 characters a line. `M2` made it worse only in that the rail now has
 *   a reason to be there. The rules below therefore take the pane's width, and a pane that
 *   is phone-sized reads like a phone: the app already sets that column well.
 *
 * Dependencies
 *   `@/theme` for the form-factor union, the spacing scale and the step table. No React,
 *   no I/O.
 */

import {
  layout,
  scriptureStepByFormFactor,
  spacing,
  type FormFactor,
  type ScriptureStep,
} from '@/theme';

/**
 * Below this pane width, the reading canvas stops pretending to be a tablet.
 *
 * `layout.contextRail.minReader` is the width the *desktop* split refuses to shrink the
 * scripture below, and it is the same judgement in a different regime: at 460 dp a tablet
 * gutter still leaves a comfortable measure, and under it the column is a phone's column
 * whatever the window says.
 */
export const PHONE_LIKE_PANE_DP = layout.contextRail.minReader;

/**
 * How wide the scripture pane actually is, once the rails beside it are taken off.
 *
 * @param contentWidth - The window minus the app's own navigation chrome, from
 *   `contentWidthFor`.
 * @param railWidth - The context rail's width, or `0` when there is none.
 * @returns The pane width in dp, never negative. Side effects: none.
 */
export function readerPaneWidth(contentWidth: number, railWidth: number): number {
  return Math.max(0, contentWidth - railWidth);
}

/**
 * Horizontal padding between the scripture column and the edge of its pane, in dp.
 *
 * @param form - The current form factor.
 * @param paneWidth - How wide the scripture pane is. Omit only where it is genuinely
 *   unknown; a pane narrower than {@link PHONE_LIKE_PANE_DP} takes the phone's gutter
 *   whatever the window is, because the 32 dp it would otherwise spend on air is 32 dp the
 *   line does not have.
 * @returns The gutter in dp. Side effects: none.
 */
export function readerGutterFor(form: FormFactor, paneWidth?: number): number {
  const phoneLike = form === 'phone' || (paneWidth !== undefined && paneWidth < PHONE_LIKE_PANE_DP);
  return phoneLike ? spacing.lg : spacing.xxl;
}

/**
 * Which scripture type step a pane of this width reads at.
 *
 * @param form - The current form factor.
 * @param paneWidth - How wide the scripture pane is.
 * @returns The step. A phone-sized pane reads at the phone's step, so a narrow column is
 *   not also set in the largest type in the app. Side effects: none.
 */
export function readerScriptureStep(form: FormFactor, paneWidth?: number): ScriptureStep {
  if (paneWidth !== undefined && paneWidth < PHONE_LIKE_PANE_DP) {
    return scriptureStepByFormFactor.phone;
  }
  return scriptureStepByFormFactor[form];
}

/**
 * Turns the design system's measure into a `maxWidth` style value.
 *
 * `readingMeasure.phone` is `0`, meaning uncapped — a phone is already narrower than any
 * cap worth applying. `0` as a literal `maxWidth` would collapse the column to nothing, so
 * it has to become "no constraint" exactly once, here.
 *
 * @param measure - `useResponsiveLayout().readingMeasure`.
 * @returns The cap in dp, or `undefined` when the column is uncapped. Side effects: none.
 */
export function columnMaxWidth(measure: number): number | undefined {
  return measure > 0 ? measure : undefined;
}
