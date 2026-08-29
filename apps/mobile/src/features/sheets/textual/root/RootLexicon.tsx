/**
 * RootLexicon — what the lexicon says, and how often the word is used.
 *
 * Purpose
 *   The two middle sections of `image6.png`: a DEFINITION card, and the statistic strip
 *   under it. They are one component because they answer one question — what this word
 *   means and how much weight it carries — and because splitting them would put the
 *   rarity sentence in a different file from the numbers it describes.
 *
 * Responsibilities
 *   - Owns: the layout of the definition and the statistic strip.
 *   - Does NOT own: the wording of the rarity sentence or the caption plurals. Those are
 *     factual claims and live in `root-usage.ts`, where they are tested.
 *
 * The gloss and the definition are different things
 *   `gloss` is the two- or three-word sense the alignment matched on ("dealer in purple");
 *   `definition` is the lexicon's fuller entry ("a female seller of purple cloth"). When
 *   both exist, both are shown — the gloss leads, because it is what the English in the
 *   verse actually said. Five Strong's numbers minted from TAGNT have no definition at all
 *   (`ASSUMPTIONS.md`, `L-04`), so the fuller entry is genuinely optional.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { StatRow } from '@/components/surface/StatRow';
import { metadataText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { SheetSection } from '../chrome/SheetSection';
import type { RootSheetPayload } from '../model/textual-payloads';
import { rarityNote, usageStats } from './root-usage';

/** Inputs to {@link RootLexicon}. */
export interface RootLexiconProps {
  /** The `[Root]` payload. */
  readonly payload: RootSheetPayload;
  /** The badge's hue, for the section eyebrows. */
  readonly tint: string;
}

/**
 * The definition and usage sections.
 *
 * @param props - See {@link RootLexiconProps}.
 * @returns Two sections.
 *
 * Side effects: none.
 */
export function RootLexicon({ payload, tint }: RootLexiconProps): JSX.Element {
  const styles = useStyles(useTheme());

  return (
    <>
      <SheetSection eyebrow="Definition" badgeTint={tint} testID="root-definition">
        <Text style={styles.gloss}>{payload.gloss}</Text>
        {payload.definition === undefined ? null : (
          <Text style={styles.definition}>{payload.definition}</Text>
        )}
        {payload.morphology === undefined ? null : (
          <View style={styles.morphology}>
            <Text style={styles.morphologyLabel}>Parsing</Text>
            <Text style={styles.definition}>{payload.morphology}</Text>
          </View>
        )}
      </SheetSection>

      <SheetSection eyebrow="Usage" badgeTint={tint} testID="root-usage">
        <StatRow stats={usageStats(payload)} />
        <Text style={styles.rarity} testID="root-rarity">
          {rarityNote(payload)}
        </Text>
      </SheetSection>
    </>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  gloss: { ...uiText('lg', 'semiBold'), color: theme.ink.primary },
  definition: { ...uiText('md'), color: theme.ink.secondary },
  morphology: { gap: spacing.xs },
  morphologyLabel: { ...metadataText('sm', 'medium'), color: theme.ink.secondary },
  rarity: { ...uiText('sm'), color: theme.ink.secondary },
}));
