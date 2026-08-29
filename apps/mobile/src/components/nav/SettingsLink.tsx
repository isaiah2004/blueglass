/**
 * SettingsLink.
 *
 * Purpose
 *   The one way into `/settings`, drawn identically wherever the chrome puts it: the nav
 *   rail's footer at >= 600 dp, and the focused screen's header below that. It is its own
 *   component because it had been written once, in `NavRailFooter`, and a phone therefore
 *   had **no route to Settings at all** — the screen existed and worked, and nothing on a
 *   375 dp window could reach it.
 *
 * Why `router.push` on a plain `Pressable` rather than `<Link asChild>`
 *   `asChild` renders its own anchor around the child and the measured hit area collapsed
 *   to the 20 dp glyph, where WCAG 2.5.8 asks for 44. Measured in a browser, not read off
 *   the JSX.
 *
 * Harness contract
 *   `testID="nav-settings"` — `SHELL_IDS.settings` in `e2e/support/test-ids.ts`. Exactly
 *   one may be mounted at a time, which is what `ShellControls` guarantees.
 */

import { useRouter } from 'expo-router';
import type { JSX } from 'react';
import { Pressable } from 'react-native';

import { borderWidth, radius, size, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { Icon } from './Icon';

/** Opacity while the control is held down. */
const PRESSED_OPACITY = 0.62;

/**
 * A link to the settings screen.
 *
 * @returns The button. Side effects: navigates to `/settings` on press.
 */
export function SettingsLink(): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        router.push('/settings');
      }}
      accessibilityRole="link"
      accessibilityLabel="Settings"
      testID="nav-settings"
      style={({ pressed }) => [styles.button, pressed && { opacity: PRESSED_OPACITY }]}
    >
      <Icon name="settings" color={theme.ink.secondary} />
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
  },
}));
