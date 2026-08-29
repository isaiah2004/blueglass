/**
 * Tab layout — the five-tab shell, at every width.
 *
 * Purpose
 *   Declares the app's primary navigation — Home, Bible, Discover, Studio, Journal
 *   (`docs/product/prd.md` "Tab 1"-"Tab 5") — and chooses where its chrome sits. Route
 *   order here is the bar order, and must match `components/nav/nav-destinations.ts`.
 *
 * Responsibilities
 *   - Owns: which tabs exist, their route names, and whether the navigator puts its bar at
 *     the bottom or down the left.
 *   - Does NOT own: what the bar looks like. `AdaptiveTabBar` draws all three shapes, and
 *     `nav-destinations.ts` holds the glyphs, labels and accents.
 *
 * Why `tabBarPosition` and a custom `tabBar`, rather than two navigators
 *   `Q-006` needs a bottom bar under 600 dp and a left rail above it. Swapping navigators
 *   at a breakpoint would remount every screen on a window resize and lose the reader's
 *   scroll position — on the web, where windows are resized casually, that is a real bug
 *   rather than a theoretical one. One navigator with a moving bar keeps the tree intact.
 *
 * What replaced `NO_ICON`
 *   The scaffold rendered no icons and had to explicitly suppress React Navigation's
 *   `MissingIcon` placeholder, which had shipped as a literal "⏷" twice per tab. The custom
 *   `tabBar` below draws the whole bar, so React Navigation never gets the chance.
 *
 * The sixth route that is not a tab
 *   `read/` is the reading canvas. It is inside this group so it keeps the bar and the rail
 *   — outside it, a deep link to `/read/john/3` produced a screen with no navigation at all
 *   — and `href: null` keeps it out of the bar, because Bible already points at it.
 */

import { Tabs } from 'expo-router';
import type { JSX } from 'react';

import { AdaptiveTabBar } from '@/components/nav/AdaptiveTabBar';
import { navDestinations } from '@/components/nav/nav-destinations';
import { ShellChromeProvider } from '@/components/nav/shell-chrome';
import { useResponsiveLayout, useTheme } from '@/theme/runtime';

/**
 * Render the tab navigator.
 *
 * @returns The five-tab shell, with its chrome at the bottom on a phone and down the left
 *   on a tablet or desktop. Headers are hidden — every screen draws its own.
 */
export default function TabLayout(): JSX.Element {
  const theme = useTheme();
  const { hasNavigationRail } = useResponsiveLayout();

  return (
    // At >= 600 dp the rail's footer carries the theme toggle, so the screens below must
    // not draw their own. Below that the bar has room for five tabs and nothing else.
    <ShellChromeProvider hasThemeToggle={hasNavigationRail}>
      <Tabs
        tabBar={(props) => <AdaptiveTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.background.canvas },
          tabBarPosition: hasNavigationRail ? 'left' : 'bottom',
        }}
      >
        {navDestinations.map((destination) => (
          <Tabs.Screen
            key={destination.routeName}
            name={destination.routeName}
            options={{ title: destination.label }}
          />
        ))}
        <Tabs.Screen name="read" options={{ href: null, title: 'Reader' }} />
      </Tabs>
    </ShellChromeProvider>
  );
}
