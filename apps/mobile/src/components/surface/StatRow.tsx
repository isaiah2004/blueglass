/**
 * StatRow.
 *
 * Purpose
 *   The stat strip the mockups put under every hero and inside every sheet: a row of
 *   number-and-caption pairs separated by hairlines (`image1.png`, `image10.png`). Small,
 *   but it appears on four screens, and hand-rolling it four times is how four different
 *   caption sizes end up in the same app.
 *
 * Typography, and the accessibility rule inside it
 *   The value is UI sans; the caption is the uppercase tracked monospace `design-language.md`
 *   §3 reserves for metadata. That caption is 10 pt, which is normal text for WCAG, so it is
 *   painted `ink.secondary` and never `ink.tertiary` — assumption `Q-017`, which holds in
 *   both palettes.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { borderWidth, metadataText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** One statistic. */
export interface Stat {
  /** The number or short value. */
  readonly value: string;
  /** The uppercase caption beneath it. */
  readonly caption: string;
}

/** Inputs to {@link StatRow}. */
export interface StatRowProps {
  /** The statistics, left to right. */
  readonly stats: readonly Stat[];
}

/**
 * A row of statistics.
 *
 * @param props - See {@link StatRowProps}.
 * @returns The row.
 *
 * Side effects: none.
 */
export function StatRow({ stats }: StatRowProps): JSX.Element {
  const styles = useStyles(useTheme());

  return (
    <View style={styles.row}>
      {stats.map((stat, index) => (
        <View
          key={stat.caption}
          style={[styles.cell, index === 0 ? null : styles.divided]}
          accessibilityLabel={`${stat.value} ${stat.caption}`}
        >
          <Text style={styles.value}>{stat.value}</Text>
          <Text style={styles.caption}>{stat.caption}</Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  cell: { flex: 1, gap: spacing.xs, paddingHorizontal: spacing.md },
  divided: { borderLeftWidth: borderWidth.hairline, borderLeftColor: theme.line.hairline },
  value: { ...uiText('lg', 'semiBold'), color: theme.accent.gold },
  caption: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
}));
