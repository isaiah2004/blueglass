/**
 * The evidence chips beside a badge's claim — and the rule that stops them repeating it.
 *
 * Purpose
 *   `design-language.md` §8.3 wants a visible source chip beside every claim, and `AI-05`
 *   makes it non-optional. `BadgeDetail` already prints the full attribution strip below the
 *   claim, so a chip only earns its place when it says something that strip does not.
 *
 * Which chips survive is not decided here
 *   `badge-evidence.ts` owns that rule and is tested on its own, because "does this chip
 *   repeat the strip below it?" is arithmetic over strings and should never need a renderer
 *   to answer.
 *
 * Wrapping is a correctness requirement, not a nicety
 *   An attribution line is a sentence. A chip that cannot wrap is a single unbreakable line,
 *   and in the 290 dp context rail it was clipped by an ancestor — the page did not even
 *   scroll, so the citation simply vanished mid-word. `AI-05` attribution the reader is meant
 *   to be able to check must be readable at every width, so a chip shrinks and wraps inside
 *   its container.
 *
 * Dependencies
 *   The theme, this folder's models, and the `badge-evidence` rule. No data fetching.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, metadataText, radius, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { distinctEvidence } from './badge-evidence';
import type { Citation, SourceAttribution } from './badge-models';

/** What the evidence block needs. */
export interface BadgeEvidenceProps {
  /** The badge's citations, in the server's order. */
  readonly citations: readonly Citation[];
  /** The sources the attribution strip below is going to print. */
  readonly sources: readonly SourceAttribution[];
  /** Test hook. */
  readonly testID?: string | undefined;
}

/** Heading above the chips. */
const EVIDENCE_HEADING = 'Evidence';

/**
 * Render the evidence chips.
 *
 * @param props - See {@link BadgeEvidenceProps}.
 * @returns The chip list, or `null` when every citation is already printed in full by the
 *   attribution strip — which is every badge M2 ships. Side effects: none.
 */
export function BadgeEvidence({
  citations,
  sources,
  testID,
}: BadgeEvidenceProps): JSX.Element | null {
  const theme = useTheme();
  const chips = distinctEvidence(citations, sources);

  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={styles.section} testID={testID}>
      <Text style={[styles.eyebrow, { color: theme.ink.tertiary }]}>{EVIDENCE_HEADING}</Text>
      <View style={styles.chips}>
        {chips.map((citation) => (
          <View
            key={citation.id}
            style={[
              styles.chip,
              { borderColor: theme.line.hairline, backgroundColor: theme.background.card },
            ]}
          >
            <Text style={[styles.chipLabel, { color: theme.ink.secondary }]}>{citation.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  eyebrow: metadataText('sm'),
  // `minWidth: 0` is what lets a wrapped row's item be narrower than its own content; React
  // Native defaults `flexShrink` to 0, so without both a chip stays at its intrinsic width
  // and overflows the surface rather than wrapping inside it.
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  chip: {
    borderRadius: radius.control,
    borderWidth: borderWidth.hairline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  chipLabel: { ...uiText('xs'), flexShrink: 1 },
});
