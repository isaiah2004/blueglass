/**
 * GroundingMeter — how well grounded a `[Context]` payload's summary is.
 *
 * Purpose
 *   `ContextBadgePayload.groundingConfidence` is the one signal `design-language.md` §8.3
 *   requires the sheet to surface: a summary written from retrieved sources at `high` or
 *   `medium` confidence reads normally, and one written at `low` confidence says so out
 *   loud rather than presenting a shaky answer with the same authority as a solid one.
 *
 * Responsibilities
 *   - Owns: the meter's three-step scale and its accessible value.
 *   - Does NOT own: the low-confidence caveat's wording — see `ContextSheet.tsx`'s
 *     `CaveatNote`, which is the thing a reader actually reads; this meter is the glance.
 *
 * Accessibility
 *   Same `role="progressbar"` / `aria-value*` pairing as `StrengthMeter`, for the same
 *   reason: react-native-web maps the ARIA attributes and drops `accessibilityValue`
 *   entirely, and web is a first-class target (`T-01`).
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import type { GroundingConfidence } from '@atlas/shared';
import { metadataText, radius, spacing, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** Inputs to {@link GroundingMeter}. */
export interface GroundingMeterProps {
  /** The confidence level. */
  readonly confidence: GroundingConfidence;
  /** The badge's hue, used when confidence is not `low`. */
  readonly tint: string;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/** The bar's full width in dp. */
const BAR_WIDTH = 56;

/** The bar's thickness in dp. */
const BAR_HEIGHT = 4;

/** A whole bar, as a percentage. */
const FULL_PERCENT = 100;

/** How far the fill runs for each level, as a fraction. */
const CONFIDENCE_RATIO: Record<GroundingConfidence, number> = { low: 1 / 3, medium: 2 / 3, high: 1 };

/** The word printed above the bar. */
function confidenceLabel(confidence: GroundingConfidence): string {
  switch (confidence) {
    case 'high':
      return 'Well grounded';
    case 'medium':
      return 'Grounded';
    case 'low':
      return 'Low confidence';
  }
}

/**
 * The grounding-confidence meter.
 *
 * @param props - See {@link GroundingMeterProps}.
 * @returns The meter, in the state's own colour: the badge's hue for `high`/`medium`,
 *   `state.danger` for `low`, so a shaky answer looks different at a glance and not just
 *   in the caveat under it.
 *
 * Side effects: none.
 */
export function GroundingMeter({ confidence, tint, testID }: GroundingMeterProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const hue = confidence === 'low' ? theme.state.danger : tint;
  const ratio = CONFIDENCE_RATIO[confidence];

  return (
    <View
      style={styles.meter}
      testID={testID ?? 'context-grounding-meter'}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={3}
      aria-valuenow={ratio * 3}
      aria-valuetext={confidenceLabel(confidence)}
    >
      <Text style={[styles.label, { color: hue }]}>{confidenceLabel(confidence)}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * FULL_PERCENT}%`, backgroundColor: hue }]} />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  meter: { gap: spacing.xs },
  label: metadataText('xs', 'bold'),
  track: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: theme.line.hairline,
    overflow: 'hidden',
  },
  fill: { height: BAR_HEIGHT, borderRadius: radius.pill },
}));
