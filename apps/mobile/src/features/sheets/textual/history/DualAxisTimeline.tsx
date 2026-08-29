/**
 * DualAxisTimeline — the world down one side, scripture down the other.
 *
 * Purpose
 *   `docs/product/mockups/image5.png`'s Empire Timeline: two series and a spine between
 *   them, aligned so that a reader can see who held the throne while a passage happened.
 *   `Q-016` caps it at the New Testament era, which is why every reign it draws is Roman or
 *   Judaean rather than a chronology of the whole canon.
 *
 * Responsibilities
 *   - Owns: the two columns, the spine, the "you are here" marker, and the fallback to a
 *     single stacked column when there is not room for two.
 *   - Does NOT own: which nodes belong on which row. `timeline-rows.ts` merges the axes,
 *     and it is tested without a renderer because a mis-aligned timeline still looks like a
 *     timeline.
 *
 * Why it measures itself instead of asking the breakpoint
 *   This body renders in a phone sheet (~375 dp), in a fixed tablet rail (~340 dp) and in a
 *   desktop split pane the reader can drag to almost any width. The form factor therefore
 *   does not predict the space available: a desktop can hand this component a narrower box
 *   than a phone does. `onLayout` answers the question that actually matters.
 *
 * The colours, and §8.2
 *   Blue for the world axis is the `[History]` badge's own hue. Gold for the biblical axis
 *   follows both `image5.png` and §2's existing use of gold for scripture's own nouns —
 *   place names and verse numbers. Gold still means the reader's own text; it never means
 *   the system.
 */

import { useState, type JSX } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import { borderWidth, metadataText, radius, spacing, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import type { HistorySheetPayload } from '../model/textual-payloads';
import { TimelineNode } from './TimelineNode';
import { buildTimelineRows, type TimelineRow } from './timeline-rows';

/**
 * The width, in dp, below which the two axes stack into one column.
 *
 * Two columns need about 170 dp each before a ruler's title — "Tiberius Julius Alexander,
 * Procurator of Judaea" — starts breaking one word to a line, plus the spine between them
 * and the card's own inset. Below that the stacked layout is more readable than a squeezed
 * pair, and the year grouping is preserved either way.
 */
const TWO_AXIS_MIN_WIDTH = 420;

/**
 * Fixed dimensions this timeline owns.
 *
 * Deliberately not in `@/theme`'s `size`: nothing else in the app draws a spine, and
 * publishing three tokens with one caller each would make the shared scale harder to read
 * for no gain. They are named constants, not literals in a style block.
 */
const SPINE = { width: 24, dot: 8, markedDot: 12 } as const;

/** Inputs to {@link DualAxisTimeline}. */
export interface DualAxisTimelineProps {
  /** The `[History]` payload. */
  readonly payload: HistorySheetPayload;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/** What each axis is called, and where its colour comes from. */
const AXIS_TITLE = { world: 'The world', biblical: 'Scripture' } as const;

/**
 * The timeline.
 *
 * @param props - See {@link DualAxisTimelineProps}.
 * @returns Two aligned axes, or one stacked column when the box is narrow.
 *
 * Side effects: none. Measures itself via `onLayout`.
 */
export function DualAxisTimeline({ payload, testID }: DualAxisTimelineProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const [width, setWidth] = useState(0);
  const rows = buildTimelineRows(payload);
  // Until the first layout pass the width is 0, and the stacked column is the safe guess:
  // it is readable at every width, where two columns are not.
  const columns = width >= TWO_AXIS_MIN_WIDTH;
  const hues = { world: theme.badge.history.tint, biblical: theme.accent.gold };

  return (
    <View
      testID={testID ?? 'history-timeline'}
      style={styles.timeline}
      onLayout={(event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
      }}
    >
      {columns ? (
        <View style={styles.headerRow}>
          <Text style={[styles.axisTitle, { color: hues.world }]}>{AXIS_TITLE.world}</Text>
          <View style={styles.spineSpacer} />
          <Text style={[styles.axisTitle, styles.rightTitle, { color: hues.biblical }]}>
            {AXIS_TITLE.biblical}
          </Text>
        </View>
      ) : (
        <AxisLegend hues={hues} />
      )}

      {rows.map((row) => (
        <TimelineRowView key={row.key} row={row} columns={columns} hues={hues} />
      ))}
    </View>
  );
}

/**
 * Which axis is which, when the layout has stacked and the columns no longer say.
 *
 * Without it a stacked timeline asks the reader to infer the two series from the colour of
 * a 2 dp edge, which is exactly the kind of thing that works for the person who built it
 * and for nobody else.
 *
 * @param props.hues - The two axis colours.
 * @returns The legend.
 *
 * Side effects: none.
 */
function AxisLegend({ hues }: { readonly hues: AxisHues }): JSX.Element {
  const styles = useStyles(useTheme());

  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendSwatch, { backgroundColor: hues.world }]} />
        <Text style={[styles.axisTitle, styles.legendLabel, { color: hues.world }]}>
          {AXIS_TITLE.world}
        </Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendSwatch, { backgroundColor: hues.biblical }]} />
        <Text style={[styles.axisTitle, styles.legendLabel, { color: hues.biblical }]}>
          {AXIS_TITLE.biblical}
        </Text>
      </View>
    </View>
  );
}

/**
 * The test hook a row carries only when it is the reader's own year.
 *
 * Spread rather than passed as `undefined`: `exactOptionalPropertyTypes` makes an explicit
 * `testID: undefined` a type error, and it would also reach the DOM as an empty attribute.
 *
 * @param row - The merged row.
 * @returns The props to spread. Side effects: none.
 */
function passageRowProps(row: TimelineRow): { readonly testID?: string } {
  return row.isPassageYear ? { testID: 'history-row-passage' } : {};
}

/** The two axis hues, resolved from the theme once. */
interface AxisHues {
  readonly world: string;
  readonly biblical: string;
}

/**
 * One year of the timeline.
 *
 * @param props.row - The merged row.
 * @param props.columns - Whether there is room for two columns.
 * @param props.hues - The two axis colours.
 * @returns The row.
 *
 * Side effects: none.
 */
function TimelineRowView({
  row,
  columns,
  hues,
}: {
  readonly row: TimelineRow;
  readonly columns: boolean;
  readonly hues: AxisHues;
}): JSX.Element {
  const styles = useStyles(useTheme());
  const world = row.world.map((event) => (
    <TimelineNode key={event.id} event={event} tint={hues.world} />
  ));
  const biblical = row.biblical.map((event) => (
    <TimelineNode key={event.id} event={event} tint={hues.biblical} />
  ));

  if (!columns) {
    return (
      <View style={styles.stackedRow} {...passageRowProps(row)}>
        <Spine marked={row.isPassageYear} stacked />
        <View style={styles.stackedNodes}>
          {world}
          {biblical}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row} {...passageRowProps(row)}>
      <View style={styles.column}>{world}</View>
      <Spine marked={row.isPassageYear} stacked={false} />
      <View style={styles.column}>{biblical}</View>
    </View>
  );
}

/**
 * The rule between the axes, and the marker on the reader's own year.
 *
 * @param props.marked - True on the passage's year.
 * @param props.stacked - Whether the layout has collapsed to one column.
 * @returns The spine segment.
 *
 * Side effects: none.
 */
function Spine({
  marked,
  stacked,
}: {
  readonly marked: boolean;
  readonly stacked: boolean;
}): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);

  return (
    <View style={stacked ? styles.stackedSpine : styles.spine}>
      <View
        style={[
          styles.dot,
          marked ? styles.markedDot : null,
          { backgroundColor: marked ? theme.accent.gold : theme.line.strong },
        ]}
        {...(marked
          ? {
              testID: 'history-passage-marker',
              accessibilityLabel: 'The passage you are reading',
            }
          : {})}
      />
      <View style={styles.rule} />
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  // No gap between rows: the spine is drawn per row, so a gap would break the vertical rule
  // into disconnected stubs. The breathing room lives on the columns instead.
  timeline: { gap: spacing.none },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  axisTitle: { ...metadataText('md', 'bold'), flex: 1 },
  rightTitle: { textAlign: 'right' },
  spineSpacer: { width: SPINE.width },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendSwatch: { width: SPINE.dot, height: SPINE.dot, borderRadius: radius.pill },
  // The label must not shrink: at a narrow width it wraps "The world" onto two lines and
  // the legend stops reading as a legend.
  legendLabel: { flexGrow: 0, flexShrink: 0 },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  column: { flex: 1, gap: spacing.sm, paddingBottom: spacing.md },
  spine: { width: SPINE.width, alignItems: 'center' },
  // `line.strong` rather than `line.hairline`: at 8 % white the rule is invisible against
  // the card, and a spine nobody can see is not a spine.
  rule: { flex: 1, width: borderWidth.hairline, backgroundColor: theme.line.strong },
  dot: { width: SPINE.dot, height: SPINE.dot, borderRadius: radius.pill, marginTop: spacing.sm },
  markedDot: { width: SPINE.markedDot, height: SPINE.markedDot },
  stackedRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  stackedSpine: { width: SPINE.width, alignItems: 'center' },
  stackedNodes: { flex: 1, gap: spacing.sm, paddingBottom: spacing.md },
}));
