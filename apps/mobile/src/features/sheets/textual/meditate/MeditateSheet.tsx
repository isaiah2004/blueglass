/**
 * MeditateSheet — the `[Meditate]` badge's sheet body.
 *
 * Purpose
 *   The reflect step that completes the 5-minute daily habit loop: an invitation, one or
 *   more questions to sit with, and how long the pause is designed to take.
 *
 * Responsibilities
 *   - Owns: the order of the sections and the badge's hue.
 *   - Does NOT own: the wording of the prompt or questions, or the breathing pacer itself
 *     (this sheet states the pace; it does not animate it — that belongs to whichever
 *     screen hosts the guided pause).
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { SheetHeading } from '../chrome/SheetHeading';
import { SheetSection } from '../chrome/SheetSection';
import { SourceStrip } from '../chrome/SourceStrip';
import type { SheetChrome } from '../model/sheet-chrome';
import type { MeditateSheetBadge } from '../model/textual-payloads';
import { verseLabel } from '../model/verse-target';
import { breathCycleCaption, durationCaption } from './meditate-timing';

/** Inputs to {@link MeditateSheet}. */
export interface MeditateSheetProps {
  /** The badge, envelope and payload. */
  readonly badge: MeditateSheetBadge;
  /** `full` (the default) draws the heading and the source strip; `body` omits both. */
  readonly chrome?: SheetChrome;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * The `[Meditate]` sheet body.
 *
 * @param props - See {@link MeditateSheetProps}.
 * @returns The sheet's content, top to bottom.
 *
 * Side effects: none.
 */
export function MeditateSheet({
  badge,
  chrome = 'full',
  testID,
}: MeditateSheetProps): JSX.Element {
  const theme = useTheme();
  const tint = theme.badge.meditate.tint;
  const { payload, anchor } = badge;
  const caption =
    payload.breathCycleSeconds === undefined
      ? durationCaption(payload.suggestedDurationSeconds)
      : `${durationCaption(payload.suggestedDurationSeconds)} · ${breathCycleCaption(payload.breathCycleSeconds)}`;

  return (
    <View style={styles.sheet} testID={testID ?? 'meditate-sheet'}>
      {chrome === 'body' ? null : (
        <SheetHeading
          eyebrow="Meditate"
          tint={tint}
          title="A moment to reflect"
          reference={verseLabel(anchor.verse)}
          summary={payload.prompt}
        />
      )}

      <SheetSection eyebrow="Questions to sit with" badgeTint={tint} caption={caption} testID="meditate-questions">
        <View style={styles.questionList}>
          {payload.reflectionQuestions.map((question) => (
            <Text key={question} style={[styles.question, { color: theme.ink.primary }]}>
              {question}
            </Text>
          ))}
        </View>
      </SheetSection>

      {chrome === 'body' ? null : (
        <SourceStrip sources={badge.sources} testID="meditate-sources" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.xl },
  questionList: { gap: spacing.md },
  question: uiText('sm'),
});
