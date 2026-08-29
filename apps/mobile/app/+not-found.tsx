/**
 * Not-found route.
 *
 * Purpose
 *   Catches any URL Expo Router cannot match — a stale deep link, a bad share URL, a typed
 *   address on the web build — and offers one way back rather than a blank screen (rule 6:
 *   no silent failures).
 *
 * Both themes
 *   Reads the active theme rather than the module-level `colors` constant, so a reader who
 *   chose light does not get a black error screen. `D-01` says "every component verified in
 *   both"; the ones nobody demos are exactly where that fails.
 */

import { useRouter } from 'expo-router';
import type { JSX } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppBackground } from '@/components/surface/AppBackground';
import { borderWidth, radius, size, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** @returns A screen explaining the miss, with a link home. */
export default function NotFoundScreen(): JSX.Element {
  const styles = useStyles(useTheme());
  const router = useRouter();

  return (
    <AppBackground>
      <View style={styles.screen} testID="not-found-screen">
        <Text style={styles.title} accessibilityRole="header">
          That page does not exist.
        </Text>
        {/* `router.replace` on a `Pressable`, not `<Link>`: an Expo Router `Link` renders an
            inline `<a>` on the web, whose box is the line height — 21 px, against the 44 px
            WCAG 2.5.8 asks of a target. `replace` rather than `push` so the bad URL does not
            stay in the history for the back button to return to. */}
        <Pressable
          onPress={() => {
            router.replace('/');
          }}
          accessibilityRole="link"
          accessibilityLabel="Go to Home"
          testID="not-found-home"
          style={styles.homeButton}
        >
          <Text style={styles.link}>Go to Home</Text>
        </Pressable>
      </View>
    </AppBackground>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  screen: { flex: 1, justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  title: { ...uiText('xl', 'semiBold'), color: theme.ink.primary },
  homeButton: {
    alignSelf: 'flex-start',
    minHeight: size.tapTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: borderWidth.hairline,
    borderColor: theme.line.strong,
  },
  link: { ...uiText('md', 'medium'), color: theme.accent.cyan },
}));
