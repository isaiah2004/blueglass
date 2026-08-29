/**
 * Which of the three context-rail regimes a window width selects.
 *
 * Purpose
 *   Two components need the same answer and must never disagree about it. `ContextRailShell`
 *   asks it to decide what to lay out; the reader asks it to decide whether a selected verse
 *   opens in the rail or in a bottom sheet. When the reader guessed instead — it used
 *   `formFactor === 'desktop'` — the tablet band got the phone layout *and* believed it had
 *   a rail, which is how `reader-context-rail` came to exist at no width at all.
 *
 * The three regimes
 *   | regime | when | divider |
 *   |---|---|---|
 *   | `none` | a phone, or a window too narrow for a rail beside readable scripture | — |
 *   | `fixed` | there is room for a rail and not enough to let the reader spoil either pane | none |
 *   | `resizable` | at or above the 1100 dp split breakpoint, with room for both minimums | yes |
 *
 * Dependencies
 *   `@/theme`'s breakpoints and `./split-geometry`. No React — the rule is arithmetic, so
 *   it is tested without rendering anything.
 */

import { contextRailMinimum, layout, type FormFactor } from '@/theme';

import { canSplit, type SplitBounds } from './split-geometry';

/** How the context rail is presented, if at all. */
export type ContextRailMode = 'none' | 'fixed' | 'resizable';

/** The window as the rail rule sees it. */
export interface ContextRailInput {
  /** The window width in dp. */
  readonly width: number;
  /** Which layout that width selects. */
  readonly formFactor: FormFactor;
}

/**
 * How wide the window is once the app's own navigation chrome is taken off it.
 *
 * The nav rail and the desktop sidebar sit outside the reader but inside the window, so
 * they come off the width before anything asks whether two panes fit.
 *
 * @param input - See {@link ContextRailInput}.
 * @returns The room available to the reader and the rail, in dp, never negative.
 *   Side effects: none.
 */
export function contentWidthFor({ width, formFactor }: ContextRailInput): number {
  if (formFactor === 'phone') return Math.max(0, width);
  const chrome = formFactor === 'desktop' ? layout.navSidebar.width : layout.navRail.width;
  return Math.max(0, width - chrome);
}

/**
 * The bounds a resizable split would be laid out within at this width.
 *
 * @param input - See {@link ContextRailInput}.
 * @returns The split bounds. Side effects: none.
 */
export function contextRailBounds(input: ContextRailInput): SplitBounds {
  return {
    containerWidth: contentWidthFor(input),
    handleWidth: layout.contextRail.handleWidth,
    minPane: contextRailMinimum(input.formFactor),
    minOther: layout.contextRail.minReader,
  };
}

/**
 * How much width the context rail takes in a given regime.
 *
 * `resizable` reports the width the rail OPENS at, not the width it may have been dragged
 * to — only `ContextRailShell` knows that. Callers that need an exact number for a dragged
 * rail must measure; callers deciding reading density do not, because that regime already
 * guarantees the reading pane at least `layout.contextRail.minReader`.
 *
 * @param mode - The regime, from {@link contextRailMode}.
 * @returns The rail's width in dp, or `0` when there is no rail. Side effects: none.
 */
export function contextRailWidth(mode: ContextRailMode): number {
  if (mode === 'none') return 0;
  return mode === 'fixed' ? layout.contextRail.minTablet : layout.contextRail.initial;
}

/**
 * Which regime a window is in.
 *
 * @param input - See {@link ContextRailInput}.
 * @returns The regime. Side effects: none.
 *
 * @example
 * contextRailMode({ width: 375, formFactor: 'phone' });    // 'none'
 * contextRailMode({ width: 768, formFactor: 'tablet' });   // 'fixed'
 * contextRailMode({ width: 1280, formFactor: 'desktop' }); // 'resizable'
 */
export function contextRailMode(input: ContextRailInput): ContextRailMode {
  if (input.formFactor === 'phone') return 'none';
  if (input.formFactor === 'desktop' && canSplit(contextRailBounds(input))) return 'resizable';

  const available = contentWidthFor(input);
  const fits = available - layout.contextRail.minTablet >= layout.contextRail.minReaderTablet;
  return fits ? 'fixed' : 'none';
}
