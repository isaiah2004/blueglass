/**
 * ThemeSwitcher.
 *
 * Purpose
 *   The visible half of decision `D-01`: three positions — System, Light, Dark — with the
 *   choice persisted. Dark is the default, and "System" is the default *position*, so a
 *   reader on a light OS gets a light app the first time they open it without touching
 *   anything.
 *
 * Responsibilities
 *   - Owns: the switcher's copy, and the line of feedback saying what "System" currently
 *     resolves to. That line is the difference between a control that looks broken (you
 *     pick System, nothing appears to happen) and one that explains itself.
 *   - Does NOT own: persistence or resolution. Both live in the provider
 *     (`theme/theme-context.tsx`) and the pure rules beside it.
 *
 * Accessibility
 *   The `radiogroup` contract comes from `SegmentedControl`. The status line is a live
 *   region, so a screen-reader user hears the theme change rather than only seeing it.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import {
  metadataText,
  spacing,
  themePreferenceLabel,
  themePreferences,
  uiText,
  type ThemePreference,
  type Theme,
} from '@/theme';
import { createThemedStyles, useTheme, useThemeController } from '@/theme/runtime';

import { Icon } from '../nav/Icon';
import type { IconName } from '../nav/nav-icons';
import { SegmentedControl, type SegmentOption } from './SegmentedControl';

/** The glyph beside each position, for the summary row. */
const PREFERENCE_ICON = {
  system: 'display',
  light: 'sun',
  dark: 'moon',
} as const satisfies Record<ThemePreference, IconName>;

/** The three options, built from the same tuple the resolver uses. */
const OPTIONS: readonly SegmentOption<ThemePreference>[] = themePreferences.map((preference) => ({
  value: preference,
  label: themePreferenceLabel[preference],
  accessibilityLabel:
    preference === 'system'
      ? 'Match the system appearance'
      : `Always use the ${themePreferenceLabel[preference].toLowerCase()} theme`,
}));

/**
 * The theme control.
 *
 * @returns A labelled segmented control plus a line saying what is actually rendering.
 *
 * Side effects: changing the selection persists it through the theme provider.
 */
export function ThemeSwitcher(): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const { preference, themeName, setPreference } = useThemeController();

  const resolved = themePreferenceLabel[themeName];
  const status =
    preference === 'system'
      ? `Following your system — ${resolved.toLowerCase()} right now`
      : `Always ${resolved.toLowerCase()}`;

  return (
    <View style={styles.group}>
      <Text style={styles.heading}>Appearance</Text>
      <SegmentedControl
        options={OPTIONS}
        value={preference}
        onChange={setPreference}
        accessibilityLabel="Appearance"
        testID="theme-switcher"
      />
      <View style={styles.status} accessibilityLiveRegion="polite" testID="theme-status">
        <Icon name={PREFERENCE_ICON[themeName]} size={16} color={theme.ink.secondary} />
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  group: { gap: spacing.md },
  heading: { ...metadataText('md', 'bold'), color: theme.ink.secondary },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusText: { ...uiText('sm'), color: theme.ink.secondary },
}));
