/**
 * The heading every spatial sheet opens with.
 *
 * Purpose
 *   `image1.png` heads its sheet with a title, a line of supporting copy, and a small
 *   uppercase eyebrow. Both spatial sheets want the same three, and hand-rolling them twice
 *   is how two different title sizes end up in one feature.
 *
 * Accessibility
 *   The title carries `accessibilityRole="header"`, so a screen reader lands on it when the
 *   sheet opens rather than reading the map's label first.
 *
 * Dependencies
 *   The typography and colour tokens only.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { metadataText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** Inputs to {@link SheetHeading}. */
export interface SheetHeadingProps {
  /** The small uppercase label above the title, e.g. `ROUTE`. */
  readonly eyebrow: string;
  /** The sheet's name, e.g. `Derbe to Thyatira`. */
  readonly title: string;
  /** One line of supporting copy, or `null` to omit it rather than print an empty row. */
  readonly subtitle: string | null;
}

/**
 * Render a sheet heading.
 *
 * @param props - See {@link SheetHeadingProps}.
 * @returns The heading block.
 *
 * Side effects: none.
 */
export function SheetHeading({ eyebrow, title, subtitle }: SheetHeadingProps): JSX.Element {
  const styles = useStyles(useTheme());

  return (
    <View style={styles.block} testID="spatial-sheet-heading">
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle === null ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  block: { gap: spacing.xs },
  // The eyebrow is cyan: `design-language.md` §8 gives cyan to the system's own analysis,
  // and a badge kind is the system naming what it found.
  eyebrow: { ...metadataText('xs', 'medium'), color: theme.accent.cyan },
  title: { ...uiText('xl', 'semiBold'), color: theme.ink.primary },
  subtitle: { ...uiText('sm'), color: theme.ink.secondary },
}));
