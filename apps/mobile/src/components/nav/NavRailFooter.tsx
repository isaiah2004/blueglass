/**
 * NavRailFooter.
 *
 * Purpose
 *   The two controls that sit at the bottom of the tablet rail and the desktop sidebar:
 *   the theme toggle and a link to Settings. They are chrome, not destinations, so they are
 *   below the five tabs and separated by a rule rather than mixed into the tab list — a
 *   sixth item in a five-tab `tablist` would be announced as "tab 6 of 6" by a screen
 *   reader, which is a lie.
 *
 * Why it does not exist on a phone
 *   A bottom bar has room for five tabs and nothing else. On a phone the same two controls
 *   live in the focused screen's own header, drawn by `./ShellControls` — which is what
 *   keeps exactly one of each mounted at any width. The walkthrough addresses both by a
 *   single test id, and two matches is an ambiguous locator rather than a nicer layout.
 */

import type { JSX } from 'react';
import { View } from 'react-native';

import { borderWidth, spacing, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { ThemeToggleButton } from '../controls/ThemeToggleButton';
import { SettingsLink } from './SettingsLink';

/** Inputs to {@link NavRailFooter}. */
export interface NavRailFooterProps {
  /** True on desktop, where the footer lays its controls out in a row rather than a column. */
  readonly isWide: boolean;
}

/**
 * The rail's footer controls.
 *
 * @param props - See {@link NavRailFooterProps}.
 * @returns The theme toggle and the settings link.
 *
 * Side effects: navigating to `/settings`; the toggle persists the theme preference.
 */
export function NavRailFooter({ isWide }: NavRailFooterProps): JSX.Element {
  const styles = useStyles(useTheme());

  return (
    <View style={[styles.footer, isWide ? styles.row : styles.column]}>
      <ThemeToggleButton />
      <SettingsLink />
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  footer: {
    // Pushes the footer to the bottom of the rail without a spacer view.
    marginTop: 'auto',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: theme.line.hairline,
  },
  column: { flexDirection: 'column' },
  row: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: spacing.sm },
}));
