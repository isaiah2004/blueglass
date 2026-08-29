/**
 * Every badge in the chapter, repeated at the bottom of it.
 *
 * Purpose
 *   `design-language.md` §5 and `image9.png`. The inline pill is the signature interaction,
 *   but it asks the reader to break off mid-sentence to use it. This list is the same context
 *   offered at the one moment the reader has finished reading and is looking for what next —
 *   which is why it is a real feature and not a decoration.
 *
 * It lists more than the text shows
 *   The reading canvas caps inline pills at two per verse so a sentence never becomes a
 *   toolbar (`chapter-badges.ts`). Nothing is capped here. A badge that lost its place inline
 *   is still reachable, which is precisely what makes the cap safe to apply.
 *
 * Attribution
 *   The teasers are claims, so `AI-05` applies to them exactly as it applies to a sheet. The
 *   chapter's union of sources is printed once beneath the list rather than once per row.
 *
 * Dependencies
 *   The theme, `BadgeAttribution`, and `BadgeSummaryRow`. No data fetching, no navigation.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, metadataText, spacing } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { ReaderBadge, SourceAttribution } from './badge-models';
import { BadgeAttribution } from './BadgeAttribution';
import { BadgeSummaryRow } from './BadgeSummaryRow';

/** What the summary needs. */
export interface ChapterBadgeSummaryProps {
  /** Every badge the chapter delivered, in the server's order. */
  readonly badges: readonly ReaderBadge[];
  /** The union of their sources, for one attribution strip. */
  readonly sources: readonly SourceAttribution[];
  /**
   * Open one badge.
   *
   * @param badgeId - The badge's stable id.
   */
  readonly onOpen: (badgeId: string) => void;
}

/** The eyebrow above the list. */
const HEADING = 'In this chapter';

/**
 * Render the chapter-end badge list.
 *
 * @param props - See {@link ChapterBadgeSummaryProps}.
 * @returns The list, or `null` for a chapter with no enrichment — most of the canon today.
 *   An empty heading over an empty rule would be worse than nothing: it would tell the reader
 *   something is missing when in fact nothing was promised. Side effects: none beyond
 *   `onOpen`.
 */
export function ChapterBadgeSummary({
  badges,
  sources,
  onOpen,
}: ChapterBadgeSummaryProps): JSX.Element | null {
  const theme = useTheme();

  if (badges.length === 0) {
    return null;
  }

  return (
    <View
      testID="chapter-badge-summary"
      style={[styles.block, { borderTopColor: theme.line.hairline }]}
    >
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.ink.tertiary }]}>
        {HEADING}
      </Text>
      <View style={styles.rows}>
        {badges.map((badge) => (
          <BadgeSummaryRow key={badge.id} badge={badge} onOpen={onOpen} />
        ))}
      </View>
      <BadgeAttribution sources={sources} testID="chapter-badge-sources" />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: borderWidth.hairline,
    gap: spacing.md,
  },
  heading: metadataText('sm'),
  rows: { gap: spacing.xs },
});
