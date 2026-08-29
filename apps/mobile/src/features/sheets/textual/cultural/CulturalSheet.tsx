/**
 * CulturalSheet — the `[Cultural]` badge's sheet body.
 *
 * Purpose
 *   The ancient-custom sheet: what the practice was, which world it belongs to, and,
 *   where the sources support one, a present-day comparison marked as interpretation
 *   rather than evidence.
 *
 * Responsibilities
 *   - Owns: the order of the sections and the badge's hue.
 *   - Does NOT own: the world label — see `cultural-world.ts`.
 *
 * Why the modern parallel is its own section
 *   `CulturalBadgePayload.modernParallel` is kept apart from `explanation` on purpose
 *   (`literary-badge.types.ts` sibling comment in `historical-badge.types.ts`): the custom
 *   itself is sourced, the comparison to today is the sheet's own reading of it, and a
 *   reader is entitled to tell the two apart.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { SheetHeading } from '../chrome/SheetHeading';
import { SheetSection } from '../chrome/SheetSection';
import { SourceStrip } from '../chrome/SourceStrip';
import type { SheetChrome } from '../model/sheet-chrome';
import type { CulturalSheetBadge } from '../model/textual-payloads';
import { verseLabel } from '../model/verse-target';
import { worldLabel } from './cultural-world';

/** Inputs to {@link CulturalSheet}. */
export interface CulturalSheetProps {
  /** The badge, envelope and payload. */
  readonly badge: CulturalSheetBadge;
  /** `full` (the default) draws the heading and the source strip; `body` omits both. */
  readonly chrome?: SheetChrome;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * The `[Cultural]` sheet body.
 *
 * @param props - See {@link CulturalSheetProps}.
 * @returns The sheet's content, top to bottom.
 *
 * Side effects: none.
 */
export function CulturalSheet({
  badge,
  chrome = 'full',
  testID,
}: CulturalSheetProps): JSX.Element {
  const theme = useTheme();
  const tint = theme.badge.cultural.tint;
  const { payload, anchor } = badge;

  return (
    <View style={styles.sheet} testID={testID ?? 'cultural-sheet'}>
      {chrome === 'body' ? null : (
        <SheetHeading
          eyebrow="Cultural"
          tint={tint}
          title={payload.custom}
          reference={verseLabel(anchor.verse)}
          summary={worldLabel(payload.world)}
        />
      )}

      <SheetSection eyebrow="What it was" badgeTint={tint} testID="cultural-explanation">
        <Text style={[styles.body, { color: theme.ink.primary }]}>{payload.explanation}</Text>
      </SheetSection>

      {payload.modernParallel === undefined ? null : (
        <SheetSection
          eyebrow="A present-day comparison"
          accent="cyan"
          caption="This comparison is this sheet's reading, not a sourced fact."
          testID="cultural-modern-parallel"
        >
          <Text style={[styles.body, { color: theme.ink.primary }]}>{payload.modernParallel}</Text>
        </SheetSection>
      )}

      {chrome === 'body' ? null : (
        <SourceStrip sources={badge.sources} testID="cultural-sources" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.xl },
  body: uiText('sm'),
});
