/**
 * StatRow.
 *
 * Purpose
 *   The stat strip the mockups put under every hero and inside every sheet: a row of
 *   number-and-caption pairs separated by hairlines (`image1.png`, `image10.png`). Small,
 *   but it appears on four screens, and hand-rolling it four times is how four different
 *   caption sizes end up in the same app.
 *
 * Why it measures itself
 *   Three equal cells inside a 232 dp context rail leave about 60 px each, and at that
 *   width react-native-web's default `overflow-wrap: break-word` breaks a caption *inside*
 *   a word: `STRAIGHT LINE` rendered as `STRAIGH` / `T LINE`, and every figure was split
 *   from its unit. So the strip measures its own width and lays out as many cells as
 *   `size.statCell` allows, wrapping the rest onto a second row. The rule is
 *   `./stat-row-layout`, tested at the three widths `Q-006` names; the figure is joined to
 *   its unit with a no-break space by whoever formats it.
 *
 * Typography, and the accessibility rule inside it
 *   The value is UI sans; the caption is the uppercase tracked monospace `design-language.md`
 *   §3 reserves for metadata. That caption is 10 pt, which is normal text for WCAG, so it is
 *   painted `ink.secondary` and never `ink.tertiary` — assumption `Q-017`, which holds in
 *   both palettes.
 */

import { useState, type JSX } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import { borderWidth, metadataText, size, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { statColumns, statRows } from './stat-row-layout';

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
 * A row of statistics, wrapped onto more rows when the cells would be too narrow.
 *
 * @param props - See {@link StatRowProps}.
 * @returns The strip.
 *
 * Side effects: holds the strip's measured width in local state.
 */
export function StatRow({ stats }: StatRowProps): JSX.Element {
  const styles = useStyles(useTheme());
  const [width, setWidth] = useState<number | null>(null);
  const columns = statColumns(width, stats.length, size.statCell);

  const onLayout = (event: LayoutChangeEvent): void => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.strip} onLayout={onLayout} testID="stat-row">
      {statRows(stats, columns).map((row) => (
        <View key={row[0]?.caption ?? ''} style={styles.row}>
          {row.map((stat, index) => (
            <View
              key={stat.caption}
              style={[styles.cell, index === 0 ? null : styles.divided]}
              accessibilityLabel={`${stat.value} ${stat.caption}`}
            >
              <Text style={styles.value}>{stat.value}</Text>
              <Text style={styles.caption}>{stat.caption}</Text>
            </View>
          ))}
          {/* Spacers, so a short last row keeps the columns above it aligned. */}
          {Array.from({ length: columns - row.length }, (_, index) => (
            <View key={`spacer-${String(index)}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  strip: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  cell: { flex: 1, gap: spacing.xs, paddingHorizontal: spacing.md },
  divided: { borderLeftWidth: borderWidth.hairline, borderLeftColor: theme.line.hairline },
  value: { ...uiText('lg', 'semiBold'), color: theme.accent.gold },
  caption: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
}));
