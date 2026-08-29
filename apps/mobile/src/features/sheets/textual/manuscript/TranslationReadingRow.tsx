/**
 * TranslationReadingRow — one translation's rendering of a disputed passage.
 *
 * Purpose
 *   `image8.png`'s comparison strip: the translation's short code beside how it actually
 *   reads the variant, so a reader can see the disagreement without leaving the sheet.
 *
 * Responsibilities
 *   - Owns: this one row's layout.
 *   - Does NOT own: which translations are shown or their order — the API returns them in
 *     the order the sheet prints them (`ManuscriptBadgePayload.translationReadings`).
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import type { TranslationReading } from '@atlas/shared';
import { metadataText, scriptureText, spacing, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** Inputs to {@link TranslationReadingRow}. */
export interface TranslationReadingRowProps {
  /** The translation and its reading. */
  readonly reading: TranslationReading;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * One translation's reading.
 *
 * @param props - See {@link TranslationReadingRowProps}.
 * @returns The row.
 *
 * Side effects: none.
 */
export function TranslationReadingRow({
  reading,
  testID,
}: TranslationReadingRowProps): JSX.Element {
  const styles = useStyles(useTheme());

  return (
    <View
      style={styles.row}
      testID={testID ?? `manuscript-translation-${reading.translationCode}`}
    >
      <Text style={styles.code}>{reading.translationCode}</Text>
      <Text style={styles.text}>{reading.text}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  row: { gap: spacing.xs, paddingVertical: spacing.sm },
  code: { ...metadataText('sm', 'bold'), color: theme.accent.gold },
  text: { ...scriptureText('sm'), color: theme.ink.primary },
}));
