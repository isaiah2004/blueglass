/**
 * ManuscriptSheet — the `[Manuscript]` badge's sheet body.
 *
 * Purpose
 *   `docs/product/mockups/image8.png`'s Codex Sinaiticus sheet: what is in dispute, the
 *   manuscripts that carry each reading (with a folio image when one is licensed), and how
 *   current translations resolve it.
 *
 * Responsibilities
 *   - Owns: the order of the sections and the badge's hue.
 *   - Does NOT own: the sheet chrome, or which manuscripts exist — `ManuscriptBadgePayload`
 *     requires at least two witnesses, since `packages/shared` types "there is no variant"
 *     as simply not shipping this badge.
 *
 * Why a witness's image is optional and never a placeholder
 *   Folio photography is separately licensed per manuscript (`design-language.md`'s source
 *   list); a witness whose image is not licensed for display shows its reading as text only
 *   rather than a broken-image icon standing in for a right we do not have.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { SheetHeading } from '../chrome/SheetHeading';
import { SheetSection } from '../chrome/SheetSection';
import { SourceStrip } from '../chrome/SourceStrip';
import type { SheetChrome } from '../model/sheet-chrome';
import type { ManuscriptSheetBadge } from '../model/textual-payloads';
import { verseLabel } from '../model/verse-target';
import { TranslationReadingRow } from './TranslationReadingRow';
import { WitnessCard } from './WitnessCard';

/** Inputs to {@link ManuscriptSheet}. */
export interface ManuscriptSheetProps {
  /** The badge, envelope and payload. */
  readonly badge: ManuscriptSheetBadge;
  /** `full` (the default) draws the heading and the source strip; `body` omits both. */
  readonly chrome?: SheetChrome;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * The `[Manuscript]` sheet body.
 *
 * @param props - See {@link ManuscriptSheetProps}.
 * @returns The sheet's content, top to bottom.
 *
 * Side effects: none.
 */
export function ManuscriptSheet({
  badge,
  chrome = 'full',
  testID,
}: ManuscriptSheetProps): JSX.Element {
  const theme = useTheme();
  const tint = theme.badge.manuscript.tint;
  const { payload, anchor } = badge;

  return (
    <View style={styles.sheet} testID={testID ?? 'manuscript-sheet'}>
      {chrome === 'body' ? null : (
        <SheetHeading
          eyebrow="Manuscript"
          tint={tint}
          title="Textual variant"
          reference={verseLabel(anchor.verse)}
          summary={payload.variantSummary}
        />
      )}

      <SheetSection
        eyebrow="Witnesses"
        badgeTint={tint}
        caption={`${String(payload.witnesses.length)} manuscripts`}
        testID="manuscript-witnesses"
      >
        <View style={styles.witnessList}>
          {payload.witnesses.map((witness) => (
            <WitnessCard key={witness.id} witness={witness} />
          ))}
        </View>
      </SheetSection>

      <SheetSection eyebrow="How translations render it" badgeTint={tint} testID="manuscript-translations">
        {payload.translationReadings.length === 0 ? (
          <Text style={[styles.empty, { color: theme.ink.secondary }]} testID="manuscript-translations-empty">
            No translation comparison is sourced for this variant.
          </Text>
        ) : (
          payload.translationReadings.map((reading) => (
            <TranslationReadingRow key={reading.translationCode} reading={reading} />
          ))
        )}
      </SheetSection>

      {chrome === 'body' ? null : (
        <SourceStrip sources={badge.sources} testID="manuscript-sources" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.xl },
  witnessList: { gap: spacing.lg },
  empty: uiText('sm'),
});
