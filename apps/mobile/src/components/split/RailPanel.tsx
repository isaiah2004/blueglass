/**
 * RailPanel.
 *
 * Purpose
 *   The body of the context rail: a titled, scrolling panel on the elevated surface. It is
 *   separate from `ScreenScaffold` because the two have opposite jobs — the scaffold paints
 *   the app *canvas*, and a rail that painted the canvas again would be invisible against
 *   the reader beside it. Measured, not assumed: the first version reused the scaffold and
 *   the rail and the reading pane rendered the same colour on a desktop screenshot.
 *
 * Responsibilities
 *   - Owns: the rail's surface, its texture, its inset, and its heading rhythm.
 *   - Does NOT own: the split, the divider, or when the rail exists at all. Those are
 *     `ContextRailShell` and `ResizableSplit`.
 *
 * Accessibility
 *   The panel is a `complementary` landmark, so a screen-reader user can jump past the
 *   scripture to the context and back.
 */

import type { JSX, ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { metadataText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { TextureOverlay } from '../surface/TextureOverlay';

/** Inputs to {@link RailPanel}. */
export interface RailPanelProps {
  /** The uppercase label above the title. */
  readonly eyebrow?: string | undefined;
  /** The panel's heading. */
  readonly title: string;
  /** The panel's contents. */
  readonly children: ReactNode;
  /** Test hook on the scrolling body. */
  readonly testID?: string | undefined;
}

/**
 * The context rail's body.
 *
 * @param props - See {@link RailPanelProps}.
 * @returns The panel.
 *
 * Side effects: none.
 */
export function RailPanel({ eyebrow, title, children, testID }: RailPanelProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);

  return (
    // `role`, not `accessibilityRole`: React Native's own role list has no `complementary`,
    // and the W3C `role` prop it added in 0.71 does.
    <View style={styles.panel} role="complementary">
      <TextureOverlay role="panel" />
      <ScrollView contentContainerStyle={styles.content} testID={testID}>
        {eyebrow === undefined ? null : <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {children}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  panel: { flex: 1, backgroundColor: theme.background.elevated, overflow: 'hidden' },
  // The bottom inset is not slack: without it the last row of a scrolling rail is sliced
  // through its middle by the window edge, in both themes.
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  eyebrow: { ...metadataText('md', 'medium'), color: theme.accent.cyan },
  title: { ...uiText('xl', 'semiBold'), color: theme.ink.primary },
}));
