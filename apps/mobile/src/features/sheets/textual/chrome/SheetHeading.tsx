/**
 * SheetHeading — the top of a textual sheet.
 *
 * Purpose
 *   Every sheet opens the same way: the badge's own name in its own hue, the thing the
 *   reader tapped as the headline, and the reference it came from underneath
 *   (`image6.png`). Having it once means the three sheets cannot drift into three
 *   different heading sizes.
 *
 * Responsibilities
 *   - Owns: the eyebrow / title / reference rhythm and their typography.
 *   - Does NOT own: the sheet's grab handle, close button or scrolling. Those belong to
 *     the host — `ReaderSheet` on a phone, the context rail above 600 dp — because the
 *     same body renders in both (`design-language.md` §4, `Q-006`).
 *
 * Both themes
 *   Colours come from the active palette and the badge hue passed in, so the heading is
 *   legible on the near-black canvas and on the light paper (`D-01`).
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { metadataText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** Inputs to {@link SheetHeading}. */
export interface SheetHeadingProps {
  /** The badge's name, uppercase, e.g. `WORD ROOT`. */
  readonly eyebrow: string;
  /** The badge's hue, from `theme.badge[kind].tint`. */
  readonly tint: string;
  /** The headline — normally the word or passage the reader tapped. */
  readonly title: string;
  /** The reference the badge is anchored to, e.g. `Acts 16:14`. */
  readonly reference?: string | undefined;
  /** One line of supporting copy under the title. */
  readonly summary?: string | undefined;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * A sheet's heading block.
 *
 * @param props - See {@link SheetHeadingProps}.
 * @returns The heading.
 *
 * Side effects: none.
 */
export function SheetHeading({
  eyebrow,
  tint,
  title,
  reference,
  summary,
  testID,
}: SheetHeadingProps): JSX.Element {
  const styles = useStyles(useTheme());

  return (
    <View style={styles.heading} testID={testID}>
      <View style={styles.eyebrowRow}>
        <Text style={[styles.eyebrow, { color: tint }]}>{eyebrow}</Text>
        {reference === undefined ? null : <Text style={styles.reference}>{reference}</Text>}
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {summary === undefined ? null : <Text style={styles.summary}>{summary}</Text>}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  heading: { gap: spacing.xs },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  eyebrow: metadataText('md', 'bold'),
  // Verse references are gold monospace throughout the app (§2, §3). Keeping that here is
  // what lets a reader recognise the reference without reading it.
  reference: { ...metadataText('md', 'medium'), color: theme.accent.gold },
  title: { ...uiText('xxl', 'semiBold'), color: theme.ink.primary },
  summary: { ...uiText('md'), color: theme.ink.secondary },
}));
