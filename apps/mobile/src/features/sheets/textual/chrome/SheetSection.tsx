/**
 * SheetSection.
 *
 * Purpose
 *   The repeating block inside every textual sheet: an uppercase monospace eyebrow, an
 *   optional caption, and a card holding the content. `image6.png` stacks four of these
 *   (definition, statistics, examples, actions) and the History and Cross-Ref sheets use
 *   the same rhythm, so it exists once.
 *
 * Responsibilities
 *   - Owns: the eyebrow's typography and hue, the caption, and the card's inset.
 *   - Does NOT own: the card surface itself. That is `@/components/surface/Card`, which
 *     holds the design language's vertical gradient, hairline and texture (§4).
 *
 * Why not `SectionCard`
 *   `SectionCard` requires a title *and* a body sentence. These sections are labels over
 *   content, not prose blocks, and passing an empty string for a required body to get the
 *   shape would put an empty `<Text>` in every card in the sheet.
 *
 * Both themes
 *   Every colour comes from `useTheme()`, so the eyebrow reads on the near-black canvas and
 *   on the light palette without a second code path (`D-01`).
 */

import type { JSX, ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/surface/Card';
import { metadataText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** Which accent an eyebrow takes. `badge` is the sheet's own hue. */
export type SectionAccent = 'badge' | 'gold' | 'cyan';

/** Inputs to {@link SheetSection}. */
export interface SheetSectionProps {
  /** The uppercase label, e.g. `DEFINITION`. */
  readonly eyebrow: string;
  /** The hue the eyebrow takes. */
  readonly accent?: SectionAccent | undefined;
  /** The sheet's own badge hue, used when `accent` is `badge`. */
  readonly badgeTint?: string | undefined;
  /** One line under the eyebrow, for a caveat or a count. */
  readonly caption?: string | undefined;
  /** The section's content. */
  readonly children: ReactNode;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * Resolve the eyebrow's colour.
 *
 * @param theme - The active palette.
 * @param accent - Which accent was asked for.
 * @param badgeTint - The sheet's hue, when the accent is `badge`.
 * @returns A colour token. Side effects: none.
 */
function eyebrowColor(theme: Theme, accent: SectionAccent, badgeTint: string | undefined): string {
  if (accent === 'gold') {
    return theme.accent.gold;
  }
  if (accent === 'badge' && badgeTint !== undefined) {
    return badgeTint;
  }

  return theme.accent.cyan;
}

/**
 * One labelled block of a sheet.
 *
 * @param props - See {@link SheetSectionProps}.
 * @returns The section.
 *
 * Side effects: none.
 */
export function SheetSection({
  eyebrow,
  accent = 'badge',
  badgeTint,
  caption,
  children,
  testID,
}: SheetSectionProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);

  return (
    <View style={styles.section} testID={testID}>
      <Text style={[styles.eyebrow, { color: eyebrowColor(theme, accent, badgeTint) }]}>
        {eyebrow}
      </Text>
      {caption === undefined ? null : <Text style={styles.caption}>{caption}</Text>}
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  section: { gap: spacing.sm },
  eyebrow: metadataText('sm', 'bold'),
  // `ink.secondary`, never `ink.tertiary`: this is small text, and `Q-017` reserves the
  // dimmest ink for large text, icons and rules because it measures 3.36:1 on `bg.card`.
  caption: { ...uiText('sm'), color: theme.ink.secondary },
  card: { padding: spacing.lg, gap: spacing.md },
}));
