/**
 * One line of the chapter-end badge summary.
 *
 * Purpose
 *   `design-language.md` §5 and `image9.png`: badge pill on the left, a one-line teaser, a
 *   chevron in the badge's hue. This is the route for a reader who does not want to tap
 *   mid-verse — which is most readers, most of the time — so it is a real feature and it
 *   opens exactly the same sheet the inline pill does.
 *
 * Why the whole row is the control
 *   The pill inside a verse is a small target by design, because it must not disturb the
 *   line. Here there is no such constraint, so the row is the button and it is a full
 *   `size.tapTarget` tall.
 *
 * Q-015 travels with the teaser
 *   A `[History]` teaser carries Hajime Murai's title for the passage, which is one scholar's
 *   reading and not a heading in the text. It is attributed here for the same reason it is
 *   attributed in the open sheet: this list is where most readers meet the claim, so an
 *   unattributed teaser here is the decision being broken in the place it matters most.
 *
 * Dependencies
 *   `@/components/nav/Icon` for the chevron, `BadgePill` for the mark, `BadgeClaimMark` for
 *   the attribution, and the theme.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/nav/Icon';
import { size, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { attributedTeaserLabel, interpretiveClaimOf } from './badge-claim';
import { themeBadgeKind } from './badge-kinds';
import type { ReaderBadge } from './badge-models';
import { BadgeClaimMark } from './BadgeClaimMark';
import { BadgePill } from './BadgePill';

/** What one summary row needs. */
export interface BadgeSummaryRowProps {
  readonly badge: ReaderBadge;
  /**
   * Open this badge.
   *
   * @param badgeId - The badge's stable id.
   */
  readonly onOpen: (badgeId: string) => void;
}

/**
 * Render one summary row.
 *
 * @param props - See {@link BadgeSummaryRowProps}.
 * @returns The row. Side effects: none beyond `onOpen`.
 */
export function BadgeSummaryRow({ badge, onOpen }: BadgeSummaryRowProps): JSX.Element {
  const theme = useTheme();
  const hue = themeBadgeKind(badge.kind);
  const claim = interpretiveClaimOf(badge);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${badge.kind} badge. ${attributedTeaserLabel(badge.teaser, claim)}`}
      testID={`badge-summary-row-${badge.id}`}
      style={styles.row}
      onPress={() => {
        onOpen(badge.id);
      }}
    >
      <View style={styles.pill}>
        <BadgePill kind={hue} />
      </View>
      <View style={styles.claim}>
        <Text numberOfLines={2} style={[styles.teaser, { color: theme.ink.secondary }]}>
          {badge.teaser}
        </Text>
        {claim === undefined ? null : (
          <BadgeClaimMark claim={claim} testID={`badge-summary-claim-${badge.id}`} />
        )}
      </View>
      <Icon name="chevronRight" size={size.icon.sm} color={theme.badge[hue].tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: size.tapTarget,
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  // A fixed column so every teaser starts on the same left edge, whatever the pill's width —
  // the alignment `image9.png` reads as a list rather than as a ragged stack.
  pill: { width: size.badgeSummaryPillColumn, alignItems: 'flex-start' },
  claim: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  teaser: { ...uiText('sm'), flexShrink: 1, minWidth: 0 },
});
