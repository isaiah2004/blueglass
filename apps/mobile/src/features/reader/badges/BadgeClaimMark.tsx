/**
 * The inline attribution beside an interpretive claim. Decision `Q-015`, on screen.
 *
 * Purpose
 *   The `[History]` badge's teaser reads "AD 47 - Paul's vision of the man of Macedonia".
 *   The year is sourced; the title is Hajime Murai's division of Acts, and `Q-015` says it
 *   ships **attributed inline** as "Murai's reading" and never as settled fact. A source line
 *   at the foot of the sheet is not that: it says where the data came from, not that this
 *   particular sentence is one scholar's reading of the structure.
 *
 *   So the mark sits beside the claim, wherever the claim is printed — the open sheet, the
 *   context rail, and the chapter-end summary list.
 *
 * Why it is quiet, and why it is NOT the uppercase metadata band
 *   It is a qualification, not a warning, so it is a hairline outline in `ink.secondary`
 *   rather than anything alarming. It is set in **sentence case**, deliberately:
 *   `design-language.md` §3 reserves the tracked uppercase band for verse references,
 *   Strong's numbers, dates, stat labels and section rules — categories of *datum*. This is
 *   a phrase that has to be read as words, `Q-015` spells it "Murai's reading", and the
 *   sheet body's own `CaveatNote` heading is already uppercase two lines below. Setting both
 *   the same way printed the identical shout twice in one surface.
 *
 * Dependencies
 *   The theme, and this folder's `badge-claim` rule. No data fetching.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, radius, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { InterpretiveClaim } from './badge-claim';

/** What the mark needs. */
export interface BadgeClaimMarkProps {
  /** The claim to attribute, from `interpretiveClaimOf`. */
  readonly claim: InterpretiveClaim;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * Render the inline attribution.
 *
 * @param props - See {@link BadgeClaimMarkProps}.
 * @returns The mark. It carries the scholar's name as its accessibility label, so a reader
 *   using a screen reader hears whose reading it is rather than an unattributed noun phrase.
 *
 * Side effects: none.
 */
export function BadgeClaimMark({ claim, testID }: BadgeClaimMarkProps): JSX.Element {
  const theme = useTheme();

  return (
    <View
      testID={testID ?? 'badge-claim-mark'}
      accessibilityLabel={`${claim.label}, ${claim.attributedTo}`}
      style={[
        styles.mark,
        { borderColor: theme.line.hairline, backgroundColor: theme.background.card },
      ]}
    >
      <Text style={[styles.label, { color: theme.ink.secondary }]}>{claim.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  label: { ...uiText('xs', 'medium'), flexShrink: 1 },
});
