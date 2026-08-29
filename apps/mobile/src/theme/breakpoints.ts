/**
 * Responsive breakpoints and the layout sizes that depend on them.
 *
 * Purpose
 *   Decision `Q-006` reinstated full phone / tablet / desktop parity with the Flutter
 *   prototype, so "which layout am I in" is a real, shared question rather than a guess
 *   made per component. This module answers it as pure arithmetic — no React, no
 *   `Dimensions` — so every rule can be tested without rendering anything.
 *
 * Key responsibilities
 *   - Name the two breakpoints (`theme.dart:204-210`: phone < 600, tablet 600-1099,
 *     desktop >= 1100) and the function that maps a width onto them.
 *   - Hold the chrome sizes those breakpoints select: the icon rail, the labelled
 *     sidebar, and the resizable context rail's clamps.
 *   - Hold the reading measure and scripture type step per form factor, because both
 *     change at the same widths and drifting them apart is how a reader ends up with
 *     100-character lines on a desktop.
 *
 * Dependencies
 *   `./typography` for the scripture type steps. Nothing else.
 *
 * Usage
 *   ```ts
 *   const form = formFactorFor(width);            // 'phone' | 'tablet' | 'desktop'
 *   const wide = form !== 'phone';                // rail instead of a bottom bar
 *   ```
 */

import type { ScriptureStep } from './typography';

/** Which of the three layouts a window width selects. */
export type FormFactor = 'phone' | 'tablet' | 'desktop';

/**
 * The two width thresholds, in dp.
 *
 * Ported verbatim from the prototype (`theme.dart:204-210`) so a screenshot of the
 * Flutter app and a screenshot of this one change shape at the same window width.
 */
export const breakpoint = {
  /** At and above this width the bottom tab bar becomes a left icon rail. */
  tablet: 600,
  /** At and above this width the icon rail becomes a labelled sidebar. */
  desktop: 1100,
} as const;

/**
 * Choose a layout from a window width.
 *
 * @param width - The window's width in dp. Non-finite and negative widths resolve to
 *   `'phone'`, which is the safe default: it is the only layout that needs no extra
 *   horizontal room.
 * @returns The form factor that width selects.
 */
export function formFactorFor(width: number): FormFactor {
  if (!Number.isFinite(width)) return 'phone';
  if (width >= breakpoint.desktop) return 'desktop';
  if (width >= breakpoint.tablet) return 'tablet';
  return 'phone';
}

/** True when the layout shows a left navigation rail instead of a bottom tab bar. */
export function usesNavigationRail(form: FormFactor): boolean {
  return form !== 'phone';
}

/** True when the layout can afford a side-by-side context pane rather than a sheet. */
export function usesSplitPane(form: FormFactor): boolean {
  return form !== 'phone';
}

/**
 * Chrome sizes, in dp.
 *
 * The rail and sidebar widths come from the prototype (`app_shell.dart:460` and `:586`).
 * The rail is 80 rather than the prototype's 78 because it carries a caption under each
 * glyph: an unlabelled rail made 600–1099 dp the one width at which a sighted reader had
 * to guess which mark was Studio, and "Discover" at the 12 dp UI step needs 64 dp of item
 * to sit on without truncating.
 */
export const layout = {
  /** The tablet navigation rail. */
  navRail: {
    width: 80,
    /** The box a single rail item occupies — glyph, caption, and 44 dp of tap target. */
    itemSize: 64,
  },
  /** The desktop labelled sidebar (`app_shell.dart:586`). */
  navSidebar: {
    width: 232,
    /** Height of one labelled row. */
    itemHeight: 44,
  },
  /** The reader's context rail: fixed on a tablet, resizable on a desktop. */
  contextRail: {
    /** Narrowest the rail may be dragged on a tablet (`app_shell.dart:365`). */
    minTablet: 280,
    /** Narrowest on a desktop, where the panel carries more content. */
    minDesktop: 320,
    /** Where the rail sits before the reader has ever dragged it. */
    initial: 340,
    /** The reader pane never shrinks below this, so scripture never becomes a column. */
    minReader: 460,
    /**
     * The reader pane's floor in the *fixed* tablet regime.
     *
     * Lower than `minReader` on purpose. A tablet has no divider to drag, so the choice is
     * not "how narrow may the reader make this" but "is a rail worth having here at all".
     * 360 dp is a phone's reading column, which is a column this app already sets well; at
     * 768 dp it leaves 404 dp of scripture beside a 280 dp rail, and at 600 dp it correctly
     * refuses the rail rather than squeezing scripture into 248 dp.
     */
    minReaderTablet: 360,
    /** The draggable divider's hit width (`resizable_split.dart:31` used 11). */
    handleWidth: 12,
  },
  /** The bottom tab bar on a phone, excluding the safe-area inset. */
  tabBar: { height: 56 },
} as const;

/**
 * The widest a column of scripture may be, in dp, per form factor.
 *
 * `0` means uncapped. The prototype capped at 520/600 for 17-20 pt type
 * (`screens/reader_screen.dart:43-47`); ours runs 19-21 pt, so the caps are scaled up
 * to hold the same character count rather than the same pixel count.
 */
export const readingMeasure = {
  phone: 0,
  tablet: 560,
  desktop: 660,
} as const satisfies Record<FormFactor, number>;

/**
 * Which scripture type step a form factor reads at.
 *
 * Mirrors the prototype's 17/19/20 progression one step larger, matching `D-03`'s
 * Source Serif 4 at the sizes `typography.ts` already fixes.
 */
export const scriptureStepByFormFactor = {
  phone: 'sm',
  tablet: 'md',
  desktop: 'lg',
} as const satisfies Record<FormFactor, ScriptureStep>;

/**
 * The narrowest the context rail may be dragged, given the form factor.
 *
 * @param form - The current layout.
 * @returns A width in dp. Phones have no rail, so they report the tablet minimum rather
 *   than zero: a caller that asks anyway gets a sane number instead of a collapsed pane.
 */
export function contextRailMinimum(form: FormFactor): number {
  return form === 'desktop' ? layout.contextRail.minDesktop : layout.contextRail.minTablet;
}
