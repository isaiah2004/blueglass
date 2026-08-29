/**
 * Window-size hooks.
 *
 * Purpose
 *   Decision `Q-006` puts phone, tablet and desktop layouts all in scope, so components
 *   need to know which one they are in — and need to be told again when a desktop window
 *   is dragged narrower. `useWindowDimensions()` already re-renders on resize; these hooks
 *   narrow that raw number down to the decision the caller actually wants, so no component
 *   ever writes `width >= 1100` itself.
 *
 * Dependencies
 *   React Native's `useWindowDimensions`, plus the pure rules in `./breakpoints`.
 */

import { useWindowDimensions } from 'react-native';

import {
  contextRailMinimum,
  formFactorFor,
  readingMeasure,
  scriptureStepByFormFactor,
  usesNavigationRail,
  usesSplitPane,
  type FormFactor,
} from './breakpoints';
import type { ScriptureStep } from './typography';

/** Everything the shell needs to lay itself out, derived from one width. */
export interface ResponsiveLayout {
  /** The window width in dp, as reported this render. */
  readonly width: number;
  /** Which of the three layouts that width selects. */
  readonly formFactor: FormFactor;
  /** True on tablet and desktop: navigation is a left rail, not a bottom bar. */
  readonly hasNavigationRail: boolean;
  /** True on desktop: the rail carries labels as well as glyphs. */
  readonly hasLabelledSidebar: boolean;
  /** True on tablet and desktop: context sits beside the reader, not in a sheet. */
  readonly hasSplitPane: boolean;
  /** The widest a column of scripture may run, in dp. `0` means uncapped. */
  readonly readingMeasure: number;
  /** The scripture type step this width reads at. */
  readonly scriptureStep: ScriptureStep;
  /** The narrowest the context rail may be dragged, in dp. */
  readonly contextRailMinimum: number;
}

/**
 * Which layout the window is currently in.
 *
 * @returns The current {@link FormFactor}. Re-renders the caller when the window crosses
 *   a breakpoint — and, on the web, on every resize frame, which is why components that
 *   only care about the bucket should use this rather than `useWindowDimensions`.
 */
export function useFormFactor(): FormFactor {
  const { width } = useWindowDimensions();
  return formFactorFor(width);
}

/**
 * The whole responsive picture in one object.
 *
 * @returns A {@link ResponsiveLayout} for the current window width.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();
  const formFactor = formFactorFor(width);

  return {
    width,
    formFactor,
    hasNavigationRail: usesNavigationRail(formFactor),
    hasLabelledSidebar: formFactor === 'desktop',
    hasSplitPane: usesSplitPane(formFactor),
    readingMeasure: readingMeasure[formFactor],
    scriptureStep: scriptureStepByFormFactor[formFactor],
    contextRailMinimum: contextRailMinimum(formFactor),
  };
}
