/**
 * DatingRationale — why this passage carries this year.
 *
 * Purpose
 *   A date on a passage is a claim, and `AI-05` means the reader is entitled to the working
 *   behind it. The server sends one: *"Dated from the Theographic event Mission to Phrygia,
 *   Galatia and Asia (AD 47), which narrates about 60% of this passage."* Hiding that behind
 *   a disclosure would make the sheet look more certain than it is, so it is shown in full,
 *   beside the number that qualifies it.
 *
 * Responsibilities
 *   - Owns: the layout of the rationale, the coverage chip, and the two notices that only
 *     appear when the data earns them.
 *   - Does NOT own: the wording of any of them. `dating-notice.ts` owns that, because every
 *     one of these strings is a factual claim and is tested as one.
 *
 * Coverage is not confidence
 *   The chip says "Covers about 60% of the passage", not "60% confident". `ASSUMPTIONS.md`
 *   `H-03` records why the number exists and what it measures: the fraction of the dating
 *   event that falls inside this passage, which is what makes the episode on the page beat
 *   the four-chapter umbrella event above it.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { borderWidth, metadataText, radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { CaveatNote } from '../chrome/CaveatNote';
import { SheetSection } from '../chrome/SheetSection';
import type { HistorySheetPayload } from '../model/textual-payloads';
import { ERA_NOTE, coveragePhrase, originNotice } from './dating-notice';

/** Inputs to {@link DatingRationale}. */
export interface DatingRationaleProps {
  /** The `[History]` payload. */
  readonly payload: HistorySheetPayload;
  /** The badge's hue. */
  readonly tint: string;
}

/**
 * The evidence behind the date.
 *
 * @param props - See {@link DatingRationaleProps}.
 * @returns The section, plus any notice the payload earns.
 *
 * Side effects: none.
 */
export function DatingRationale({ payload, tint }: DatingRationaleProps): JSX.Element {
  const styles = useStyles(useTheme());
  const coverage = coveragePhrase(payload);
  const origin = originNotice(payload);

  return (
    <SheetSection eyebrow="Why this date" badgeTint={tint} testID="history-rationale">
      <Text style={styles.rationale}>{payload.rationale}</Text>
      {coverage === undefined ? null : (
        <View style={styles.chipRow}>
          <Text style={[styles.chip, { color: tint, borderColor: tint }]}>{coverage}</Text>
        </View>
      )}
      {origin === undefined ? null : (
        <CaveatNote label={origin.label} body={origin.body} testID="history-origin-note" />
      )}
      <CaveatNote
        label={ERA_NOTE.label}
        body={ERA_NOTE.body}
        tint={tint}
        testID="history-era-note"
      />
    </SheetSection>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  rationale: { ...uiText('md'), color: theme.ink.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    ...metadataText('sm', 'medium'),
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
}));
