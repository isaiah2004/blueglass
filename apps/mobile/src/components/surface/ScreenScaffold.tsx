/**
 * ScreenScaffold.
 *
 * Purpose
 *   The frame every top-level screen sits in: the app canvas, the safe-area insets, an
 *   optional header, and a scrolling body whose content is centred and measure-capped on
 *   wide windows. Written once because the alternative is five screens that each get the
 *   desktop measure slightly differently.
 *
 * The measure cap is the point
 *   On a 2560 dp monitor a full-bleed column of text is unreadable. `theme/breakpoints.ts`
 *   caps the body at 560 dp on a tablet and 660 dp on a desktop, following the prototype's
 *   own caps (`screens/reader_screen.dart:43-47`) scaled for our larger type. Phones are
 *   uncapped, because there is nothing to cap.
 *
 * Accessibility
 *   The body is a vertical `ScrollView` only; the horizontal axis never scrolls, which is
 *   WCAG 1.4.10 (Reflow) and is the failure a wide fixed-width child produces. The header
 *   is marked as a `header` so a screen reader can jump to it.
 */

import type { JSX, ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { metadataText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useResponsiveLayout, useTheme } from '@/theme/runtime';

import { ShellControls } from '../nav/ShellControls';
import { useChromeHasThemeToggle } from '../nav/shell-chrome';
import { AppBackground } from './AppBackground';

/** Inputs to {@link ScreenScaffold}. */
export interface ScreenScaffoldProps {
  /** The screen's title, rendered as its header. */
  readonly title: string;
  /** A short uppercase line above the title. Omit for no eyebrow. */
  readonly eyebrow?: string | undefined;
  /** The screen's body. */
  readonly children: ReactNode;
  /** Extra controls rendered at the end of the header row, before the theme toggle. */
  readonly headerTrailing?: ReactNode | undefined;
  /** Test hook on the scrolling body. */
  readonly testID?: string | undefined;
  /**
   * Force the theme toggle off. Only for a screen that already offers the full appearance
   * control in its body, where a second one in the header would be noise.
   */
  readonly showThemeToggle?: boolean | undefined;
}

/**
 * Frame a top-level screen.
 *
 * @param props - See {@link ScreenScaffoldProps}.
 * @returns The framed screen.
 *
 * Side effects: none.
 */
export function ScreenScaffold({
  title,
  eyebrow,
  children,
  headerTrailing,
  testID,
  showThemeToggle,
}: ScreenScaffoldProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const { readingMeasure: measure, hasNavigationRail } = useResponsiveLayout();
  const chromeHasToggle = useChromeHasThemeToggle();
  const drawsToggle = showThemeToggle ?? !chromeHasToggle;

  return (
    <AppBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: hasNavigationRail ? spacing.xxl : insets.top + spacing.xxl },
          { paddingBottom: insets.bottom + spacing.xxxl },
        ]}
        testID={testID}
      >
        <View style={[styles.column, measure > 0 ? { maxWidth: measure } : null]}>
          <View style={styles.header} accessibilityRole="header">
            <View style={styles.headingGroup}>
              {eyebrow === undefined ? null : <Text style={styles.eyebrow}>{eyebrow}</Text>}
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
            </View>
            <View style={styles.headerControls}>
              {headerTrailing}
              {/* Exactly one theme toggle and one settings link in the whole document.
                  Inside the tab shell at >= 600 dp the nav rail's footer carries them;
                  everywhere else — a phone, or any route outside the tab group — this
                  header does, and `ShellControls` draws nothing unless this screen is the
                  focused one. `shell-chrome.tsx` is where the two halves agree. */}
              {drawsToggle ? <ShellControls /> : null}
            </View>
          </View>
          {children}
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    // Centres the measure-capped column without a fixed width, so the phone layout is
    // untouched and the desktop one never scrolls sideways.
    alignItems: 'center',
  },
  column: { width: '100%', gap: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headingGroup: { flexShrink: 1, gap: spacing.xs },
  headerControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: { ...metadataText('md', 'medium'), color: theme.accent.cyan },
  title: { ...uiText('xxl', 'semiBold'), color: theme.ink.primary },
}));
