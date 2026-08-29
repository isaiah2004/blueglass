/**
 * StrengthMeter — how strongly attested one cross-reference is.
 *
 * Purpose
 *   The `[Cross-Ref]` sheet lists six passages, and the only thing separating a settled
 *   consensus from one reader's idea is a vote count. A bare number ("43") means nothing
 *   without a scale, so the count is drawn as a proportion of the ceiling the ranking uses
 *   and labelled in words beside it.
 *
 * Responsibilities
 *   - Owns: the bar, its width, and the pairing of a word with a number.
 *   - Does NOT own: what counts as strong. `crossref-targets.ts` holds the thresholds and
 *     the ceiling, matching the server's own ranking constants.
 *
 * Accessibility
 *   It is a `progressbar` with real `min`, `max` and `now` values, so the strength is
 *   available to a screen reader as a quantity rather than as a decorative rectangle. The
 *   W3C spellings are used deliberately: react-native-web maps `aria-valuenow` and drops
 *   `accessibilityValue` entirely, and web is a first-class target (`T-01`).
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { metadataText, radius, spacing, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { VOTE_CEILING, strengthLabel, strengthRatio, votesLabel } from './crossref-targets';

/** Inputs to {@link StrengthMeter}. */
export interface StrengthMeterProps {
  /** The community vote count. */
  readonly votes: number;
  /** The badge's hue. */
  readonly tint: string;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/** The bar's full width in dp. Fixed, so every row's bar is comparable at a glance. */
const BAR_WIDTH = 56;

/** The bar's thickness in dp. A rule, not a block — this is a signal, not a chart. */
const BAR_HEIGHT = 4;

/** A whole bar, as a percentage. React Native's `DimensionValue` takes `${number}%`. */
const FULL_PERCENT = 100;

/**
 * The strength indicator.
 *
 * @param props - See {@link StrengthMeterProps}.
 * @returns The label, count and bar.
 *
 * Side effects: none.
 */
export function StrengthMeter({ votes, tint, testID }: StrengthMeterProps): JSX.Element {
  const styles = useStyles(useTheme());
  const ratio = strengthRatio(votes);
  const label = strengthLabel(votes);

  return (
    <View
      style={styles.meter}
      testID={testID}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={VOTE_CEILING}
      aria-valuenow={votes}
      aria-valuetext={`${label}, ${votesLabel(votes)}`}
    >
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * FULL_PERCENT}%`, backgroundColor: tint }]} />
      </View>
      <Text style={styles.votes}>{votesLabel(votes)}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  meter: { alignItems: 'flex-end', gap: spacing.xs },
  label: metadataText('xs', 'bold'),
  track: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: theme.line.hairline,
    overflow: 'hidden',
  },
  fill: { height: BAR_HEIGHT, borderRadius: radius.pill },
  votes: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
}));
