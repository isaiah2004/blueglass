/**
 * WitnessCard — one manuscript's reading, in the `[Manuscript]` sheet.
 *
 * Purpose
 *   `image8.png` pairs a codex photograph with the reading it carries; this is that pair,
 *   plus the manuscript's date and where it is held, for the sheet's witness list.
 *
 * Responsibilities
 *   - Owns: the witness's own layout — image above text, or text alone when no image is
 *     licensed for display (see `ManuscriptSheet.tsx`'s header comment).
 *   - Does NOT own: the outer `SheetSection` card or the list's ordering.
 */

import type { JSX } from 'react';
import { Image, Text, View } from 'react-native';

import type { ManuscriptWitness } from '@atlas/shared';
import { Card } from '@/components/surface/Card';
import { borderWidth, metadataText, radius, scriptureText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** Inputs to {@link WitnessCard}. */
export interface WitnessCardProps {
  /** The witness. */
  readonly witness: ManuscriptWitness;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * One manuscript's reading.
 *
 * @param props - See {@link WitnessCardProps}.
 * @returns The card.
 *
 * Side effects: none.
 */
export function WitnessCard({ witness, testID }: WitnessCardProps): JSX.Element {
  const styles = useStyles(useTheme());

  return (
    <Card style={styles.card} testID={testID ?? `manuscript-witness-${witness.id}`}>
      {witness.imageUrl === undefined ? null : (
        <Image
          source={{ uri: witness.imageUrl }}
          style={styles.folio}
          resizeMode="cover"
          accessibilityLabel={`Folio image of ${witness.name}`}
        />
      )}
      <View style={styles.header}>
        <Text style={styles.name}>{witness.name}</Text>
        <Text style={styles.date}>{witness.dateLabel}</Text>
      </View>
      <Text style={styles.reading}>{witness.reading}</Text>
      {witness.heldAt === undefined ? null : (
        <Text style={styles.heldAt}>{witness.heldAt}</Text>
      )}
    </Card>
  );
}

const FOLIO_HEIGHT = 180;

const useStyles = createThemedStyles((theme: Theme) => ({
  card: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: borderWidth.hairline,
    borderColor: theme.line.hairline,
  },
  folio: {
    width: '100%',
    height: FOLIO_HEIGHT,
    borderRadius: radius.control,
    marginBottom: spacing.xs,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { ...uiText('md', 'semiBold'), color: theme.ink.primary },
  date: { ...metadataText('sm', 'medium'), color: theme.ink.secondary },
  reading: { ...scriptureText('sm'), color: theme.ink.primary },
  // `ink.secondary`, not `tertiary`: this is small text, and `Q-017` reserves the dimmest
  // ink for large text, icons and rules (see `SheetSection.tsx`'s identical note).
  heldAt: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
}));
