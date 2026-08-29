/**
 * SectionCard.
 *
 * Purpose
 *   A titled card: an uppercase monospace eyebrow, a heading, a line of body copy, and
 *   whatever the caller adds. It is the shape the mockups repeat down every screen
 *   (`image5.png`, `image10.png`, `image12.png`), and having it once is what keeps the five
 *   tab screens visually consistent while each is still a placeholder for real content.
 *
 * Responsibilities
 *   - Owns: the card's internal rhythm — eyebrow, title, body, spacing.
 *   - Does NOT own: the card's surface. That is `Card`, which holds the design language's
 *     vertical gradient and hairline.
 */

import type { JSX, ReactNode } from 'react';
import { Text, View } from 'react-native';

import { metadataText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { Card } from './Card';

/** Inputs to {@link SectionCard}. */
export interface SectionCardProps {
  /** The uppercase label above the title. */
  readonly eyebrow: string;
  /** The card's heading. */
  readonly title: string;
  /** One or two sentences of body copy. */
  readonly body: string;
  /** Which accent the eyebrow takes: gold for the reader's own things, cyan for the system's. */
  readonly accent?: 'gold' | 'cyan' | undefined;
  /** Anything below the body — a stat row, a control, a list. */
  readonly children?: ReactNode | undefined;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * A titled card.
 *
 * @param props - See {@link SectionCardProps}.
 * @returns The card.
 *
 * Side effects: none.
 */
export function SectionCard({
  eyebrow,
  title,
  body,
  accent = 'cyan',
  children,
  testID,
}: SectionCardProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const eyebrowColor = accent === 'gold' ? theme.accent.gold : theme.accent.cyan;

  return (
    <Card style={styles.card} testID={testID}>
      <Text style={[styles.eyebrow, { color: eyebrowColor }]}>{eyebrow}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      {children === undefined ? null : <View style={styles.slot}>{children}</View>}
    </Card>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  card: { padding: spacing.xl, gap: spacing.sm },
  eyebrow: { ...metadataText('sm', 'bold') },
  title: { ...uiText('lg', 'semiBold'), color: theme.ink.primary },
  body: { ...uiText('md'), color: theme.ink.secondary },
  slot: { marginTop: spacing.md },
}));
