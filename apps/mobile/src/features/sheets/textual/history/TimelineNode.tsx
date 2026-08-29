/**
 * TimelineNode — one entry on one axis of the History timeline.
 *
 * Purpose
 *   A ruler, or an event scripture narrates. `image5.png` draws them as small cards with a
 *   coloured edge — blue down the Roman side, gold down the biblical side — and that edge is
 *   what lets a reader tell the two axes apart at a glance when the layout stacks on a
 *   phone and the columns are no longer side by side.
 *
 * Responsibilities
 *   - Owns: the node's typography and its coloured edge.
 *   - Does NOT own: which side it is on, or whether its detail line is worth printing.
 *     Both are decided above it — the second by `nodeDetail`, which drops a detail the
 *     label already contains.
 *
 * The date printed is the source's own words
 *   `yearLabel` is what the source says: `AD 47` for an event, `AD 41 to AD 54` for a reign,
 *   `unrecorded` for a bound nobody recorded. The numeric `sortYear` beside it in the payload
 *   is ordering only and is never rendered — the wire says so, and the reason is that it
 *   flattens exactly the uncertainty the label carries.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { borderWidth, metadataText, radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import type { TimelineEvent } from '../model/textual-payloads';
import { nodeDetail } from './timeline-rows';

/** Inputs to {@link TimelineNode}. */
export interface TimelineNodeProps {
  /** The node. */
  readonly event: TimelineEvent;
  /** The axis's hue: blue for the world, gold for scripture. */
  readonly tint: string;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * One timeline entry.
 *
 * @param props - See {@link TimelineNodeProps}.
 * @returns The node.
 *
 * Side effects: none.
 */
export function TimelineNode({ event, tint, testID }: TimelineNodeProps): JSX.Element {
  const styles = useStyles(useTheme());
  const detail = nodeDetail(event);

  return (
    <View style={[styles.node, { borderLeftColor: tint }]} testID={testID}>
      <Text style={[styles.year, { color: tint }]}>{event.yearLabel}</Text>
      <Text style={styles.label}>{event.label}</Text>
      {detail === undefined ? null : <Text style={styles.detail}>{detail}</Text>}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  node: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    // The coloured edge is `borderWidth.focus` (2 dp), not a hairline: at 1 dp on the light
    // theme's paper the two axes become indistinguishable at arm's length.
    borderLeftWidth: borderWidth.focus,
    borderRadius: radius.control,
    backgroundColor: theme.background.card,
  },
  year: metadataText('sm', 'bold'),
  label: { ...uiText('sm', 'semiBold'), color: theme.ink.primary },
  detail: { ...uiText('sm'), color: theme.ink.secondary },
}));
