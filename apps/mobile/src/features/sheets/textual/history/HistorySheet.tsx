/**
 * HistorySheet — the `[History]` badge's sheet body.
 *
 * Purpose
 *   `docs/product/mockups/image5.png`'s Empire Timeline, delivered at the point of need: the
 *   year a passage is dated to, who held the throne that year, what scripture narrates
 *   around it, and the working behind the date.
 *
 * Responsibilities
 *   - Owns: the order of the sections, the badge's hue, and the choice of what the heading
 *     asserts.
 *   - Does NOT own: the sheet chrome, the timeline's alignment, or the wording of any
 *     qualification. See `DualAxisTimeline` and `dating-notice.ts`.
 *
 * Why the heading is the year and not the title
 *   The obvious heading is "Paul's vision of the man of Macedonia" — and it is exactly the
 *   thing `Q-015` forbids putting there. That title is Hajime Murai's division of Acts, one
 *   scholar's reading, and a sheet that sets it as its `<h1>` has quietly adopted it. So the
 *   heading is the sourced year, and the title appears below it inside its attribution.
 *
 * The empty timeline is a real state
 *   A passage can be dated and still have no rulers or narrated events sourced for its year.
 *   That renders as a sentence saying so, not as an empty spine: `flutter-port-map.md` §7.4's
 *   rule that loading, empty and error are three different screens applies inside a sheet
 *   as much as it does to a canvas.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { CaveatNote } from '../chrome/CaveatNote';
import { SheetHeading } from '../chrome/SheetHeading';
import { SheetSection } from '../chrome/SheetSection';
import { SourceStrip } from '../chrome/SourceStrip';
import type { SheetChrome } from '../model/sheet-chrome';
import type { HistorySheetBadge, HistorySheetPayload } from '../model/textual-payloads';
import { passageLabel, verseLabel } from '../model/verse-target';
import { DatingRationale } from './DatingRationale';
import { DualAxisTimeline } from './DualAxisTimeline';
import { emptyTimelineCopy, muraiNotice } from './dating-notice';
import { hasTimeline } from './timeline-rows';

/** Inputs to {@link HistorySheet}. */
export interface HistorySheetProps {
  /** The badge, envelope and payload. */
  readonly badge: HistorySheetBadge;
  /** `full` (the default) draws the heading and the source strip; `body` omits both. */
  readonly chrome?: SheetChrome;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * The line under the heading: who was on the throne.
 *
 * @param payload - The `[History]` payload.
 * @returns The sentence, or `undefined` when no source names a ruler for that year.
 *   Side effects: none.
 */
function throneLine(payload: HistorySheetPayload): string | undefined {
  return payload.rulerName === undefined
    ? undefined
    : `${payload.rulerName} held the imperial throne.`;
}

/**
 * The `[History]` sheet body.
 *
 * @param props - See {@link HistorySheetProps}.
 * @returns The sheet's content, top to bottom.
 *
 * Side effects: none.
 */
export function HistorySheet({ badge, chrome = 'full', testID }: HistorySheetProps): JSX.Element {
  const theme = useTheme();
  const tint = theme.badge.history.tint;
  const { payload, anchor } = badge;
  const murai = muraiNotice(payload);
  const reference =
    payload.passage === undefined ? verseLabel(anchor.verse) : passageLabel(payload.passage);

  return (
    <View style={styles.sheet} testID={testID ?? 'history-sheet'}>
      {chrome === 'body' ? null : (
        <SheetHeading
          eyebrow="History"
          tint={tint}
          title={payload.passageYearLabel}
          reference={reference}
          summary={throneLine(payload)}
        />
      )}

      {murai === undefined ? null : (
        <CaveatNote label={murai.label} body={murai.body} tint={tint} testID="history-murai-note" />
      )}

      <SheetSection eyebrow="The world around this passage" badgeTint={tint} testID="history-axes">
        {hasTimeline(payload) ? (
          <DualAxisTimeline payload={payload} />
        ) : (
          <Text style={[styles.empty, { color: theme.ink.secondary }]} testID="history-empty">
            {emptyTimelineCopy(payload)}
          </Text>
        )}
      </SheetSection>

      <DatingRationale payload={payload} tint={tint} />

      {chrome === 'body' ? null : <SourceStrip sources={badge.sources} testID="history-sources" />}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.xl },
  empty: uiText('sm'),
});
