/**
 * The five primary destinations.
 *
 * Purpose
 *   Home · Bible · Discover · Studio · Journal (`docs/product/design-language.md` §7,
 *   `docs/product/prd.md` "Tab 1"-"Tab 5"). Three different chrome surfaces render this
 *   list — the phone tab bar, the tablet icon rail and the desktop sidebar — and they must
 *   agree on order, glyph, accent and wording. Declaring it once is what makes that true
 *   by construction rather than by review.
 *
 * The accent rule
 *   `design-language.md` §8.2 is absolute: **gold means "you", cyan means "the system"**,
 *   and the meanings never swap. So Home, Bible and Journal — the reader's own journey,
 *   reading and words — are gold; Discover and Studio — analysis and generation — are cyan.
 *   `nav-destinations.test.ts` locks the assignment, because an accent chosen for variety
 *   rather than meaning is exactly how a colour language dies.
 *
 * Dependencies
 *   `./nav-icons` for the glyph names. No React, no routing — the route name is a string
 *   here and is matched against the navigator's own state by the bar that renders it.
 */

import type { IconName } from './nav-icons';

/** Which of the two meaning-bearing accents a destination carries. */
export type NavAccent = 'gold' | 'cyan';

/** One primary destination. */
export interface NavDestination {
  /** The route's name inside `app/(tabs)`, which is also its file name. */
  readonly routeName: string;
  /** The label drawn in the tab bar and the desktop sidebar. */
  readonly label: string;
  /** The glyph drawn in all three chrome surfaces. */
  readonly icon: IconName;
  /**
   * The `testID` all three chrome surfaces put on this item.
   *
   * Fixed by the walkthrough harness's contract (`e2e/support/test-ids.ts`, `TAB_IDS`), not
   * derived from the route name: Home's route is `index`, and the harness calls it `home`.
   */
  readonly testID: string;
  /** The accent its active state is painted in. */
  readonly accent: NavAccent;
  /**
   * What a screen reader announces. Longer than the visible label on purpose: "Bible" alone
   * does not say what tapping it does, and the tab bar is the one place a reader has no
   * surrounding context to infer from.
   */
  readonly accessibilityLabel: string;
}

/**
 * The five destinations, in bar order.
 *
 * Order is load-bearing: it is the order of the tab bar, the rail, and the sidebar, and it
 * must match the `<Tabs.Screen>` order in `app/(tabs)/_layout.tsx`.
 */
export const navDestinations = [
  {
    routeName: 'index',
    testID: 'tab-home',
    label: 'Home',
    icon: 'home',
    accent: 'gold',
    accessibilityLabel: "Home. Today's reading and your streak.",
  },
  {
    routeName: 'bible',
    testID: 'tab-bible',
    label: 'Bible',
    icon: 'book',
    accent: 'gold',
    accessibilityLabel: 'Bible. The reading canvas.',
  },
  {
    routeName: 'discover',
    testID: 'tab-discover',
    label: 'Discover',
    icon: 'compass',
    accent: 'cyan',
    accessibilityLabel: 'Discover. Maps, timelines and literary patterns.',
  },
  {
    routeName: 'studio',
    testID: 'tab-studio',
    label: 'Studio',
    icon: 'sparkle',
    accent: 'cyan',
    accessibilityLabel: 'Studio. Grounded chat and briefings.',
  },
  {
    routeName: 'journal',
    testID: 'tab-journal',
    label: 'Journal',
    icon: 'notebook',
    accent: 'gold',
    accessibilityLabel: 'Journal. Your private, encrypted entries.',
  },
] as const satisfies readonly NavDestination[];

/**
 * Routes that belong to a destination without being it.
 *
 * `read` is the reading canvas, which lives inside the tab group so it keeps the chrome
 * (`app/(tabs)/_layout.tsx`) but draws no tab of its own. Without this map the bar showed
 * *no* active destination while the reader was reading, which is the one moment it most
 * needs to say where they are.
 */
const ROUTE_OWNERS: Readonly<Record<string, string>> = { read: 'bible' };

/**
 * Find a destination by its route name.
 *
 * @param routeName - The navigator's route name.
 * @returns The destination, or `undefined` when the navigator holds a route this table
 *   does not describe. Callers render a neutral fallback rather than crashing: a route
 *   added to `app/(tabs)` without a row here is a mistake, but not one worth a blank app.
 */
export function navDestinationFor(routeName: string): NavDestination | undefined {
  return navDestinations.find((destination) => destination.routeName === routeName);
}

/**
 * Which destination a route counts as, for the purpose of the active state.
 *
 * @param routeName - The navigator's route name.
 * @returns The owning destination's route name, which is `routeName` itself for the five
 *   primary destinations. Side effects: none.
 */
export function owningRouteName(routeName: string): string {
  return ROUTE_OWNERS[routeName] ?? routeName;
}
