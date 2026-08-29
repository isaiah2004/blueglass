/**
 * ThemeToggleButton.
 *
 * Purpose
 *   The one-tap half of decision `D-01`. `ThemeSwitcher` is the honest three-position
 *   control and lives in Settings; this is the icon button that belongs in the chrome, so a
 *   reader who wants light *now* does not go looking for a settings screen.
 *
 * Why it sets an explicit preference rather than cycling
 *   Cycling system -> light -> dark reads as broken from the outside: from "system" on a
 *   dark OS, the first tap appears to do nothing. This button always inverts what is
 *   currently on screen, which is what a toggle is for. Choosing "follow the system" again
 *   is a deliberate act and belongs with the other deliberate acts, in Settings.
 *
 * Accessibility
 *   `accessibilityRole="switch"` with a `checked` state, and a label that says what the tap
 *   will do rather than what the current state is — "Switch to light theme" — because a
 *   screen-reader user hears the label before the state.
 *
 * Harness contract
 *   `testID="theme-toggle"`, which is `SHELL_IDS.themeToggle` in `e2e/support/test-ids.ts`.
 *   Chapter 7 of the walkthrough clicks it on the reading canvas, so **every surface that
 *   can be a reader's whole screen must mount one** — the tab shell does, and the reader
 *   route's own header must too.
 */

import type { JSX } from 'react';
import { Pressable } from 'react-native';

import { borderWidth, radius, size, withOpacity, type Theme } from '@/theme';
import { createThemedStyles, useTheme, useThemeController } from '@/theme/runtime';

import { Icon } from '../nav/Icon';

/** Inputs to {@link ThemeToggleButton}. */
export interface ThemeToggleButtonProps {
  /** The glyph's size in dp. Defaults to the medium icon token. */
  readonly size?: number | undefined;
}

/** Opacity of the button's resting fill — ink over the surface, so it works in both themes. */
const FILL_ALPHA = 0.06;

/** Opacity while held down. */
const PRESSED_OPACITY = 0.62;

/**
 * A one-tap light/dark switch.
 *
 * @param props - See {@link ThemeToggleButtonProps}.
 * @returns The button.
 *
 * Side effects: sets and persists the theme preference through the theme provider.
 */
export function ThemeToggleButton({ size: glyphSize = size.icon.md }: ThemeToggleButtonProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const { themeName, setPreference } = useThemeController();

  const isDark = themeName === 'dark';
  const next = isDark ? 'light' : 'dark';

  return (
    <Pressable
      onPress={() => {
        setPreference(next);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      // react-native-web does not derive `aria-checked` from `accessibilityState`; without
      // this the switch announces with no state at all.
      aria-checked={isDark}
      accessibilityLabel={`Switch to ${next} theme`}
      testID="theme-toggle"
      style={({ pressed }) => [styles.button, pressed && { opacity: PRESSED_OPACITY }]}
    >
      <Icon name={isDark ? 'moon' : 'sun'} size={glyphSize} color={theme.ink.secondary} />
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  button: {
    width: size.tapTarget,
    height: size.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: theme.line.hairline,
    backgroundColor: withOpacity(theme.ink.primary, FILL_ALPHA),
  },
}));
