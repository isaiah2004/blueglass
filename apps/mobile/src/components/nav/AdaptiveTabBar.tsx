/**
 * AdaptiveTabBar.
 *
 * Purpose
 *   The navigator's own chrome, in whichever shape the window width selects: a bottom bar
 *   under 600 dp, a 72 dp icon rail from 600, a 232 dp labelled sidebar from 1100
 *   (`Q-006`; the prototype's `app_shell.dart:291-331`). It is one component so the three
 *   shapes cannot drift apart in behaviour — only in layout.
 *
 * How it is wired
 *   Passed to Expo Router's `<Tabs tabBar={...}>`, which hands it the live navigation
 *   state. The navigator lays it out: `tabBarPosition: 'left'` on the wide layouts puts it
 *   beside the scene, `'bottom'` puts it under. That option is set in `(tabs)/_layout.tsx`,
 *   not here, because it belongs to the navigator's screen options.
 *
 * Navigation is dispatched, not routed
 *   `navigation.emit` then `navigation.navigate` is React Navigation's own tab contract: it
 *   fires `tabPress` first so a screen can prevent the move (scroll-to-top on re-tap, an
 *   unsaved-changes guard), and it preserves the tab's own stack. Calling `router.push`
 *   instead would look identical and silently reset that stack.
 *
 * Accessibility
 *   `accessibilityRole="tablist"` around the items, and the safe-area inset is honoured on
 *   the bottom bar so the last row of tabs is never under a home indicator.
 */

import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { JSX } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { borderWidth, layout, spacing, type Theme } from '@/theme';
import { createThemedStyles, useResponsiveLayout, useTheme } from '@/theme/runtime';

import { TextureOverlay } from '../surface/TextureOverlay';
import { navDestinationFor, owningRouteName } from './nav-destinations';
import { NavItem, type NavItemShape } from './NavItem';
import { NavRailFooter } from './NavRailFooter';

/**
 * The `testID` the walkthrough harness addresses the bar by
 * (`e2e/support/test-ids.ts`, `SHELL_IDS.tabBar`). The rendered form factor goes on
 * `nativeID` instead, so a harness can tell the three shapes apart without a second id.
 */
const SHELL_IDS_TAB_BAR = 'tab-bar';

/** Inputs to {@link AdaptiveTabBar} — React Navigation's own tab-bar props. */
export type AdaptiveTabBarProps = BottomTabBarProps;

/**
 * Move to a tab, honouring React Navigation's own contract.
 *
 * `emit` then `navigate` is that contract: the `tabPress` event fires first so a screen can
 * prevent the move (scroll-to-top on a re-tap, an unsaved-changes guard), and `navigate`
 * preserves the tab's own stack. Calling `router.push` instead would look identical and
 * silently reset that stack.
 *
 * @param props - The live navigation state.
 * @param index - Which route in `state.routes` was pressed.
 * @returns Nothing.
 */
function moveToTab({ state, navigation }: AdaptiveTabBarProps, index: number): void {
  const route = state.routes[index];
  if (route === undefined) return;

  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
  if (state.index !== index && !event.defaultPrevented) {
    navigation.navigate(route.name, route.params);
  }
}

/**
 * Render the navigator's chrome.
 *
 * @param props - The live navigation state, from `<Tabs tabBar>`.
 * @returns The bottom bar, icon rail, or labelled sidebar.
 *
 * Side effects: dispatches navigation actions on press.
 */
export function AdaptiveTabBar(props: AdaptiveTabBarProps): JSX.Element {
  const { state } = props;
  const theme = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const { formFactor, hasNavigationRail, hasLabelledSidebar } = useResponsiveLayout();

  const shape: NavItemShape = hasLabelledSidebar ? 'sidebar' : hasNavigationRail ? 'rail' : 'bar';
  const container = [
    styles.container,
    hasNavigationRail ? styles.vertical : styles.horizontal,
    hasLabelledSidebar ? styles.sidebar : null,
    hasNavigationRail ? null : { paddingBottom: insets.bottom },
    hasNavigationRail
      ? { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom }
      : null,
  ];

  const activeRoute = owningRouteName(state.routes[state.index]?.name ?? '');

  return (
    <View
      style={container}
      accessibilityRole="tablist"
      accessibilityLabel="Primary"
      testID={SHELL_IDS_TAB_BAR}
      nativeID={`tab-bar-${formFactor}`}
    >
      <TextureOverlay role="rail" />
      {state.routes.map((route, index) => {
        const destination = navDestinationFor(route.name);
        if (destination === undefined) return null;

        return (
          <NavItem
            key={route.key}
            destination={destination}
            shape={shape}
            isActive={destination.routeName === activeRoute}
            onPress={() => {
              moveToTab(props, index);
            }}
          />
        );
      })}
      {hasNavigationRail ? <NavRailFooter isWide={hasLabelledSidebar} /> : null}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  container: {
    backgroundColor: theme.background.elevated,
    // `overflow: hidden` keeps the repeating texture inside the bar; without it the tile
    // paints over the scene on the web, where a `View` does not clip by default.
    overflow: 'hidden',
  },
  horizontal: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: borderWidth.hairline,
    borderTopColor: theme.line.hairline,
    paddingHorizontal: spacing.sm,
  },
  vertical: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xs,
    width: layout.navRail.width,
    borderRightWidth: borderWidth.hairline,
    borderRightColor: theme.line.hairline,
    paddingHorizontal: spacing.sm,
  },
  sidebar: {
    alignItems: 'stretch',
    width: layout.navSidebar.width,
    paddingHorizontal: spacing.sm,
  },
}));
