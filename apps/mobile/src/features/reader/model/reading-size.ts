/**
 * Turning the reader's chosen reading size into a type step.
 *
 * Purpose
 *   Two vocabularies meet here and neither should learn the other's. `@/stores`'s
 *   `ScriptureSize` is a *preference* — `small | medium | large`, deliberately named in
 *   words rather than points so it survives a change to the type scale. `@/theme`'s
 *   `ScriptureStep` is a *type token* — `sm | md | lg`, each bound to a size in points.
 *   This module is the one place the two are related, so a fourth reading size is a
 *   change here and nowhere else.
 *
 * Why the responsive default still matters
 *   `useResponsiveLayout().scriptureStep` already picks a size per window width, and it is
 *   the right answer for a reader who has never opened the display sheet. That is what
 *   `medium` means: not "20 pt", but "whatever this screen reads best at". Only an
 *   explicit `small` or `large` overrides the window.
 *
 * Dependencies
 *   `@/theme` and `@/stores` for the two unions. No React, no I/O.
 */

import type { ScriptureSize } from '@/stores';
import type { ScriptureStep } from '@/theme';

/** The three sizes, in the order the display control draws them. */
export const READING_SIZES: readonly ScriptureSize[] = ['small', 'medium', 'large'];

/**
 * Resolves the reader's preference against the size the window suggests.
 *
 * @param size - What the reader chose, from `usePrefs`.
 * @param responsiveStep - What `useResponsiveLayout().scriptureStep` suggests here.
 * @returns The step to set the scripture at. Side effects: none.
 */
export function resolveReadingStep(
  size: ScriptureSize,
  responsiveStep: ScriptureStep,
): ScriptureStep {
  switch (size) {
    case 'small':
      return 'sm';
    case 'large':
      return 'lg';
    case 'medium':
      return responsiveStep;
  }
}

/**
 * Human label for a reading size.
 *
 * @param size - The size to label.
 * @returns A one-word label for the segmented control. Side effects: none.
 */
export function readingSizeLabel(size: ScriptureSize): string {
  const labels: Record<ScriptureSize, string> = {
    small: 'Small',
    medium: 'Default',
    large: 'Large',
  };
  return labels[size];
}
