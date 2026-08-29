/**
 * Settings.
 *
 * Purpose
 *   The deliberate half of decision `D-01`: the full three-position appearance control,
 *   including "System", which the chrome's one-tap toggle deliberately cannot reach.
 *
 * Why it is a route outside `(tabs)`
 *   It is not a destination — it is somewhere you go and come back from. Making it a sixth
 *   tab would put a settings glyph permanently in front of a reader who opens the app to
 *   read, which is exactly the dock clutter pillar 1 rules out.
 *
 * Scope
 *   Appearance only, for now. The prototype's other two real settings — grounding and web
 *   search — belong with the AI layer and are not built (`sources_screen.dart`).
 */

import { useRouter } from 'expo-router';
import type { JSX } from 'react';
import { Pressable, Text } from 'react-native';

import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher';
import { Card } from '@/components/surface/Card';
import { ScreenScaffold } from '@/components/surface/ScreenScaffold';
import { size, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** @returns The settings screen. */
export default function SettingsScreen(): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const router = useRouter();

  return (
    <ScreenScaffold
      eyebrow="Preferences"
      title="Settings"
      testID="settings-screen"
      // The full three-position control is the body of this page; a one-tap toggle in its
      // own header would be the same setting offered twice.
      showThemeToggle={false}
      headerTrailing={
        <Pressable
          onPress={() => {
            // Settings sits outside the tab group, so it has no nav rail and no tab bar: if
            // `back()` has nowhere to go — a deep link, a refreshed browser tab — "Done"
            // would do nothing and the reader would be stranded on a page with no chrome.
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          testID="settings-close"
          style={styles.closeButton}
        >
          <Text style={styles.close}>Done</Text>
        </Pressable>
      }
    >
      <Card style={styles.card} testID="settings-appearance">
        <ThemeSwitcher />
      </Card>
    </ScreenScaffold>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  card: { padding: spacing.xl },
  // A text button still needs a 44 dp target (WCAG 2.5.8). "Done" on its own measured
  // 38x21 in a browser.
  closeButton: {
    minHeight: size.tapTarget,
    minWidth: size.tapTarget,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
  },
  close: { ...uiText('md', 'medium'), color: theme.accent.cyan },
}));
