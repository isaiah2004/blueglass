/**
 * LemmaHeader — the headword, set the way `image6.png` sets it.
 *
 * Purpose
 *   The one thing a reader came to this sheet for: the Greek or Hebrew word, large, in its
 *   own script, with its transliteration under it and its Strong's number beside it. Every
 *   other section of the `[Root]` sheet is support for this block.
 *
 * Responsibilities
 *   - Owns: the headword's size, colour and reading direction, and the Strong's chip.
 *   - Does NOT own: which face or which direction. `original-language.ts` decides both,
 *     because both are rules with consequences on a device that a component cannot test.
 *
 * The inflected form
 *   The lexicon's headword is `πορφυρόπωλις`; the verse in front of the reader may spell it
 *   `Σαμοθρᾴκην,` — inflected, and with the sentence's punctuation attached. Showing only
 *   the headword leaves the reader unable to find the word they tapped. Showing only the
 *   surface form leaves them unable to look it up. So both are shown, labelled.
 *
 * Both themes and both directions
 *   Colours come from the active palette. When the lemma is right-to-left the whole block
 *   flips its alignment with it, so a Hebrew headword and its transliteration share an edge
 *   instead of drifting to opposite sides of the card.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { borderWidth, metadataText, radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import type { RootSheetPayload } from '../model/textual-payloads';
import {
  isRightToLeft,
  languageLabel,
  lemmaAccessibilityLabel,
  originalTextStyle,
  strongsLabel,
} from './original-language';

/** Inputs to {@link LemmaHeader}. */
export interface LemmaHeaderProps {
  /** The `[Root]` payload. */
  readonly payload: RootSheetPayload;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * The headword block.
 *
 * @param props - See {@link LemmaHeaderProps}.
 * @returns The block.
 *
 * Side effects: none.
 */
export function LemmaHeader({ payload, testID }: LemmaHeaderProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const rtl = isRightToLeft(payload.language);
  const alignment = rtl ? styles.alignEnd : styles.alignStart;

  return (
    <View style={styles.block} testID={testID}>
      <View style={[styles.lemmaColumn, alignment]}>
        <Text
          testID="root-lemma"
          style={[originalTextStyle(payload.language), styles.lemma]}
          accessibilityLabel={lemmaAccessibilityLabel(
            payload.lemma,
            payload.language,
            payload.transliteration,
          )}
        >
          {payload.lemma}
        </Text>
        {payload.transliteration === undefined ? null : (
          <Text testID="root-transliteration" style={styles.transliteration}>
            {payload.transliteration}
          </Text>
        )}
      </View>

      <View style={styles.chips}>
        <Text style={styles.strongs} testID="root-strongs">
          {strongsLabel(payload.strongsNumber)}
        </Text>
        <Text style={styles.language}>{languageLabel(payload.language)}</Text>
      </View>

      <View style={[styles.surfaceRow, alignment]}>
        <Text style={styles.surfaceLabel}>As written here</Text>
        <Text
          testID="root-surface"
          style={[originalTextStyle(payload.language, 'sm'), styles.surface]}
        >
          {payload.surface}
        </Text>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  block: { gap: spacing.md },
  lemmaColumn: { gap: spacing.xs },
  alignStart: { alignItems: 'flex-start' },
  alignEnd: { alignItems: 'flex-end' },
  // Gold: §2 gives the accent to "place names, verse numbers" — the nouns of scripture —
  // and the headword is the same category of thing.
  lemma: { color: theme.accent.gold },
  transliteration: { ...uiText('lg'), color: theme.accent.cyan },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  strongs: {
    ...metadataText('md', 'bold'),
    color: theme.accent.gold,
    borderWidth: borderWidth.hairline,
    borderColor: theme.accent.goldDim,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  language: {
    ...metadataText('md', 'medium'),
    color: theme.accent.cyan,
    borderWidth: borderWidth.hairline,
    borderColor: theme.accent.cyanDim,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  surfaceRow: { gap: spacing.xs },
  surfaceLabel: { ...metadataText('sm', 'medium'), color: theme.ink.secondary },
  surface: { color: theme.ink.primary },
}));
