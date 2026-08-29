/**
 * ShellControls — the theme toggle and the settings link, mounted exactly once.
 *
 * Purpose
 *   Below 600 dp there is no nav rail, so the two chrome controls live in each screen's own
 *   header. That is the right *place* and the wrong *count*: React Navigation keeps every
 *   visited tab mounted, so after a reader has walked Home, Bible and Discover there were
 *   three `theme-toggle` nodes in the document. The walkthrough addresses the control by a
 *   single test id (`e2e/support/test-ids.ts`), and three matches is an ambiguous locator,
 *   not a nicer layout.
 *
 * The rule
 *   Only the focused screen draws them. `useIsFocused` is React Navigation's own answer to
 *   "am I the screen the reader is looking at", and it is correct for a tab screen, for a
 *   screen inside a nested stack, and for a route outside the tab group.
 *
 * Why not simply hide the inactive screens
 *   `app/_layout.tsx` does that too — `enableScreens()` makes the web build render an
 *   inactive tab `display: none`. That fixes what the reader sees; it does not remove the
 *   node from the document, and a duplicated id is a defect whether or not it is painted.
 *
 * Dependencies
 *   `expo-router` for the focus hook, and the two controls it composes.
 */

import { useIsFocused } from 'expo-router';
import type { JSX } from 'react';
import { View } from 'react-native';

import { spacing } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { ThemeToggleButton } from '../controls/ThemeToggleButton';
import { SettingsLink } from './SettingsLink';

/** Inputs to {@link ShellControls}. */
export interface ShellControlsProps {
  /** Draw the theme toggle. Off for Settings, which offers the full control in its body. */
  readonly showThemeToggle?: boolean | undefined;
  /** Draw the settings link. Off on the Settings screen itself. */
  readonly showSettings?: boolean | undefined;
}

/**
 * The chrome controls for a screen that has no nav rail above it.
 *
 * @param props - See {@link ShellControlsProps}.
 * @returns The controls, or `null` when this screen is not the focused one.
 *
 * Side effects: subscribes to the navigator's focus events.
 */
export function ShellControls({
  showThemeToggle = true,
  showSettings = true,
}: ShellControlsProps): JSX.Element | null {
  const styles = useStyles(useTheme());
  const isFocused = useIsFocused();

  if (!isFocused) return null;

  return (
    <View style={styles.group}>
      {showThemeToggle ? <ThemeToggleButton /> : null}
      {showSettings ? <SettingsLink /> : null}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  group: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
}));
