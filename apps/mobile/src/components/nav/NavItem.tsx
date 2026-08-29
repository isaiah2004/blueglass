/**
 * NavItem.
 *
 * Purpose
 *   One primary destination, in whichever of the three shapes the current layout asks for:
 *   a labelled column in the phone tab bar, a narrower labelled column in the tablet rail,
 *   or a labelled row in the desktop sidebar. `Q-006` put all three in scope, and they are one
 *   component because the *states* — active, inactive, pressed, focused — must not drift
 *   between them.
 *
 * Responsibilities
 *   - Owns: the active state's ring, the resting state's colours, the press feedback, and
 *     the accessibility contract for a tab.
 *   - Does NOT own: which destinations exist (`./nav-destinations`), or where the bar sits
 *     on screen (`./AdaptiveTabBar`).
 *
 * Every shape is labelled
 *   The tablet rail used to be glyphs only, which made 600–1099 dp the one width where a
 *   sighted reader had to guess which mark was Studio — the phone bar and the desktop
 *   sidebar both spell it out. A 72 dp rail has room for a 10 pt caption under a 20 dp
 *   glyph, so it now carries one. Screen readers were never affected: the spoken label was
 *   always there and is deliberately longer than the visible one.
 *
 * Accessibility
 *   `accessibilityRole="tab"` with `selected` state, and a spoken label longer than the
 *   visible one. The whole control is one touch target of at least 44 dp.
 *
 * Both themes
 *   Every colour comes from `useTheme()`. The inactive label is `ink.secondary`, not
 *   `ink.tertiary`: at 12 pt it is normal text, and `Q-017` measured `ink.tertiary` below
 *   WCAG AA at that size in **both** palettes. The inactive glyph stays `ink.tertiary`,
 *   which is legal for icons.
 */

import type { JSX } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { borderWidth, layout, radius, spacing, uiText, withOpacity, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { Icon } from './Icon';
import type { NavDestination } from './nav-destinations';

/** Which chrome surface is drawing the item. */
export type NavItemShape = 'bar' | 'rail' | 'sidebar';

/** Inputs to {@link NavItem}. */
export interface NavItemProps {
  /** The destination being drawn. */
  readonly destination: NavDestination;
  /** Whether this is the route currently shown. */
  readonly isActive: boolean;
  /** Which shape to draw. */
  readonly shape: NavItemShape;
  /** Called when the reader picks this destination. */
  readonly onPress: () => void;
}

/** Opacity of an active item's fill — the badge fill from `design-language.md` §5. */
const ACTIVE_SURFACE_ALPHA = 0.12;

/** Opacity of an active item's ring. */
const ACTIVE_RING_ALPHA = 0.4;

/** Opacity applied to the whole item while it is held down (`Pressable`, 120 ms). */
const PRESSED_OPACITY = 0.62;

/**
 * Resolve the accent colours for one item.
 *
 * @param theme - The active theme.
 * @param destination - The destination being drawn.
 * @param isActive - Whether it is the current route.
 * @returns The glyph colour, the label colour, and the ring's fill and border.
 */
function colorsFor(
  theme: Theme,
  destination: NavDestination,
  isActive: boolean,
): { glyph: string; label: string; fill: string; ring: string } {
  const accent = destination.accent === 'gold' ? theme.accent.gold : theme.accent.cyan;

  return {
    glyph: isActive ? accent : theme.ink.tertiary,
    // `ink.secondary`, not `ink.tertiary`: a 12 pt label is normal text and `Q-017`
    // measured tertiary below AA at that size in both themes.
    label: isActive ? accent : theme.ink.secondary,
    fill: isActive ? withOpacity(accent, ACTIVE_SURFACE_ALPHA) : 'transparent',
    ring: isActive ? withOpacity(accent, ACTIVE_RING_ALPHA) : 'transparent',
  };
}

/**
 * Draw one destination.
 *
 * @param props - See {@link NavItemProps}.
 * @returns A pressable tab.
 *
 * Side effects: none beyond the caller's `onPress`.
 */
export function NavItem({ destination, isActive, shape, onPress }: NavItemProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const tone = colorsFor(theme, destination, isActive);
  const showsLabel = shape !== 'sidebar';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      // Explicit as well as via `accessibilityState`: react-native-web does not derive
      // `aria-selected` from the state object, so on the web — a first-class target
      // (`T-01`) — the active tab announced as just another tab. Caught by
      // `NavItem.test.tsx`, which asserts the attribute rather than the prop.
      aria-selected={isActive}
      accessibilityLabel={destination.accessibilityLabel}
      testID={destination.testID}
      style={({ pressed }) => [
        styles.pressable,
        styles[shape],
        pressed && { opacity: PRESSED_OPACITY },
      ]}
    >
      <View
        style={[
          styles.ring,
          shape === 'sidebar' ? styles.ringSidebar : styles.ringCentred,
          { backgroundColor: tone.fill, borderColor: tone.ring },
        ]}
      >
        <Icon name={destination.icon} color={tone.glyph} />
        {shape === 'sidebar' ? (
          <Text style={[styles.sidebarLabel, { color: tone.label }]} numberOfLines={1}>
            {destination.label}
          </Text>
        ) : null}
      </View>
      {showsLabel ? (
        <Text style={[styles.barLabel, { color: tone.label }]} numberOfLines={1}>
          {destination.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const useStyles = createThemedStyles(() => ({
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    // The web build is the first-class target `T-01` made it; without this a tab reads as
    // selectable text and a drag inside the bar highlights the labels.
    ...Platform.select({ web: { userSelect: 'none' as const }, default: {} }),
  },
  bar: { flex: 1, gap: spacing.xs, paddingVertical: spacing.xs, minHeight: layout.tabBar.height },
  rail: {
    width: layout.navRail.itemSize,
    minHeight: layout.navRail.itemSize,
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  sidebar: { alignSelf: 'stretch', alignItems: 'stretch', paddingHorizontal: spacing.sm },
  ring: {
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },
  ringCentred: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  ringSidebar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: layout.navSidebar.itemHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
  },
  barLabel: { ...uiText('xs', 'medium') },
  sidebarLabel: { ...uiText('sm', 'medium') },
}));
