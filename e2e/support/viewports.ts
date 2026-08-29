/**
 * The three viewports the walkthrough drives, and the breakpoints they straddle.
 *
 * Purpose
 *   `Q-006` reinstated full phone / tablet / desktop parity, so the resizable rail, the
 *   two-pane split and the >=600 dp and >=1100 dp breakpoints are all in scope
 *   (`docs/decisions/DECISIONS.md` §2). A harness that only drove one width would let the
 *   third of the UI that only exists above a breakpoint ship untested.
 *
 * Why these exact sizes
 *   375x812 is the smallest phone still worth supporting; 768x1024 is the canonical tablet
 *   portrait and sits just above the 600 dp rail breakpoint; 1280x800 clears the 1100 dp
 *   split-pane breakpoint with room to spare. Each therefore lands in a different
 *   layout regime rather than merely being a different number.
 *
 * Dependencies
 *   None. Pure data, imported by `playwright.config.ts` and by the responsive chapter.
 */

/** The names of the three Playwright projects, which are also the screenshot folders. */
export type ViewportName = 'phone' | 'tablet' | 'desktop';

/** A viewport under test, with the layout regime it is chosen to exercise. */
export interface WalkthroughViewport {
  /** Project name; also the screenshot subdirectory. */
  readonly name: ViewportName;
  /** CSS pixel width. */
  readonly width: number;
  /** CSS pixel height. */
  readonly height: number;
  /** Whether the browser reports a touch screen, which changes hover and tap behaviour. */
  readonly hasTouch: boolean;
  /** One line naming what only this width can catch, quoted in failure messages. */
  readonly regime: string;
}

/**
 * The >=600 dp breakpoint: at or above it the icon rail and context rail appear.
 * `docs/architecture/flutter-port-map.md` §5.
 */
export const RAIL_BREAKPOINT_PX = 600;

/** The >=1100 dp breakpoint: at or above it the reader splits into two panes. */
export const SPLIT_BREAKPOINT_PX = 1100;

/** The three viewports, in ascending width. */
export const VIEWPORTS: readonly WalkthroughViewport[] = [
  {
    name: 'phone',
    width: 375,
    height: 812,
    hasTouch: true,
    regime: 'below both breakpoints: bottom tab bar, no rail, no split pane',
  },
  {
    name: 'tablet',
    width: 768,
    height: 1024,
    hasTouch: true,
    regime: 'above the 600 dp rail breakpoint, below the 1100 dp split breakpoint',
  },
  {
    name: 'desktop',
    width: 1280,
    height: 800,
    hasTouch: false,
    regime: 'above both breakpoints: rail plus two-pane split',
  },
] as const;

/**
 * Look up a viewport by name.
 *
 * @param name The project name.
 * @returns The viewport definition.
 * @throws {RangeError} If the name is not one of the three declared viewports.
 */
export function viewportByName(name: ViewportName): WalkthroughViewport {
  const found = VIEWPORTS.find((viewport) => viewport.name === name);
  if (found === undefined) throw new RangeError(`Unknown walkthrough viewport: ${name}`);
  return found;
}

/**
 * The minimum tap-target edge, in CSS pixels.
 *
 * 44 px is the platform guidance both Apple and Material converge on for a primary
 * control, and it is the number the brief names. It is asserted at every width, not only
 * on touch: a 32 px control is a bug on a trackpad too, merely a less painful one.
 */
export const MIN_TAP_TARGET_PX = 44;
