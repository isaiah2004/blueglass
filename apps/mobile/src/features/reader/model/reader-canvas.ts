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
 * Dependencies
 *   `@/theme` for the form-factor union and the spacing scale. No React, no I/O.
 */

import { spacing, type FormFactor } from '@/theme';

/**
 * Horizontal padding between the scripture column and the edge of its pane, in dp.
 *
 * @param form - The current form factor.
 * @returns The default screen gutter on a phone, and the section-sized one above it.
 *   Side effects: none.
 */
export function readerGutterFor(form: FormFactor): number {
  return form === 'phone' ? spacing.lg : spacing.xxl;
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
