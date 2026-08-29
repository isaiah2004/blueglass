/**
 * CrossRefSheet — the `[Cross-Ref]` badge's sheet body.
 *
 * Purpose
 *   The richest data in the product: 344,799 community-voted links between passages. The
 *   sheet's job is to make one of them followable without leaving the reading — the verse
 *   text is shown, not just its reference, so a reader can decide whether the link is worth
 *   taking before they take it.
 *
 * Why the text matters more than the list
 *   A list of references is a lookup table; the reader has to leave, read, and come back for
 *   each one to find out whether it was relevant. The API sends the text, so the sheet shows
 *   it. That is the difference between a cross-reference feature a reader uses once and a
 *   thread of scripture they can actually follow.
 *
 * Responsibilities
 *   - Owns: the order of the sections and how a link's strength is presented.
 *   - Does NOT own: the ranking (that is `crossref-targets.ts`), the row (that is
 *     `chrome/ReferenceRow`, shared with the `[Root]` sheet), or where a tap goes.
 *
 * The empty case cannot happen, and is handled anyway
 *   The server only emits this badge when a verse has a link reaching ten votes, so a
 *   payload with no targets should not exist. If one arrives, an empty section under a
 *   promising heading is worse than a sentence saying there is nothing — so it says so.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { SheetHeading } from '../chrome/SheetHeading';
import { SheetSection } from '../chrome/SheetSection';
import { SourceStrip } from '../chrome/SourceStrip';
import type { SheetChrome } from '../model/sheet-chrome';
import type { CrossRefSheetBadge } from '../model/textual-payloads';
import { verseLabel, type VerseTarget } from '../model/verse-target';
import { CrossRefTargetRow } from './CrossRefTargetRow';
import { rankedTargets, relationCaption, relationTitle } from './crossref-targets';

/** What the sheet says if a payload somehow arrives with nothing in it. */
const NO_TARGETS_COPY =
  'No linked passages reached the vote threshold for this verse. Nothing is shown rather than showing a weak link as a strong one.';

/** Inputs to {@link CrossRefSheet}. */
export interface CrossRefSheetProps {
  /** The badge, envelope and payload. */
  readonly badge: CrossRefSheetBadge;
  /** Open a passage in the reader. Omitted, the rows are readable but not pressable. */
  readonly onOpenVerse?: ((target: VerseTarget) => void) | undefined;
  /** `full` (the default) draws the heading and the source strip; `body` omits both. */
  readonly chrome?: SheetChrome;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * The `[Cross-Ref]` sheet body.
 *
 * @param props - See {@link CrossRefSheetProps}.
 * @returns The sheet's content, top to bottom.
 *
 * Side effects: none beyond `onOpenVerse`.
 */
export function CrossRefSheet({
  badge,
  onOpenVerse,
  chrome = 'full',
  testID,
}: CrossRefSheetProps): JSX.Element {
  const theme = useTheme();
  const tint = theme.badge.crossRef.tint;
  const { payload, anchor } = badge;
  const targets = rankedTargets(payload.targets);

  return (
    <View style={styles.sheet} testID={testID ?? 'cross-ref-sheet'}>
      {chrome === 'body' ? null : (
        <SheetHeading
          eyebrow="Cross-reference"
          tint={tint}
          title={relationTitle(payload.relation)}
          reference={verseLabel(anchor.verse)}
          summary={badge.teaser}
        />
      )}

      <SheetSection
        eyebrow="Linked passages"
        badgeTint={tint}
        caption={relationCaption(payload.relation, targets.length)}
        testID="cross-ref-targets"
      >
        {targets.length === 0 ? (
          <Text style={[styles.empty, { color: theme.ink.secondary }]} testID="cross-ref-empty">
            {NO_TARGETS_COPY}
          </Text>
        ) : (
          targets.map((target) => (
            <CrossRefTargetRow
              key={`${target.displayReference}-${String(target.range.start.value)}`}
              target={target}
              tint={tint}
              onOpenVerse={onOpenVerse}
            />
          ))
        )}
      </SheetSection>

      {chrome === 'body' ? null : (
        <SourceStrip sources={badge.sources} testID="cross-ref-sources" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.xl },
  empty: uiText('sm'),
});
