/**
 * ContextSheet — the `[Context]` badge's sheet body, the Studio Assistant's background.
 *
 * Purpose
 *   `image11.png`'s dual-host audio card, grounded summary, and suggested-question chips —
 *   drawn from whatever payload the sheet is handed, with a low-confidence caveat when the
 *   grounding is weak (`design-language.md` §8.3).
 *
 * Why this is a shell and not a live chat box
 *   `m3-rag-pgvector` (the tracker's own todo) is still open: the API has no pgvector/RAG
 *   module yet, and wiring a chat box to a model ahead of that fix would let an ungrounded
 *   answer through wearing a Grounding Confidence meter that lies about it. This sheet
 *   renders whatever payload it is given — a fixture today, a real one once M6 lands — and
 *   the suggested questions are shown as static chips, not yet a live input.
 *
 * Responsibilities
 *   - Owns: the order of the sections, the badge's hue, and the low-confidence caveat.
 *   - Does NOT own: audio playback (no player is wired here, only the overview's metadata)
 *     or the grounded chat itself.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, metadataText, radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { CaveatNote } from '../chrome/CaveatNote';
import { SheetHeading } from '../chrome/SheetHeading';
import { SheetSection } from '../chrome/SheetSection';
import { SourceStrip } from '../chrome/SourceStrip';
import type { SheetChrome } from '../model/sheet-chrome';
import type { ContextSheetBadge } from '../model/textual-payloads';
import { verseLabel } from '../model/verse-target';
import { GroundingMeter } from './GroundingMeter';

/** Shown under the meter when grounding is weak. */
const LOW_CONFIDENCE_BODY =
  'This summary is only loosely grounded in the sourced material for this passage. Read it as a starting point, not a settled answer.';

/** Inputs to {@link ContextSheet}. */
export interface ContextSheetProps {
  /** The badge, envelope and payload. */
  readonly badge: ContextSheetBadge;
  /** `full` (the default) draws the heading and the source strip; `body` omits both. */
  readonly chrome?: SheetChrome;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * The `[Context]` sheet body.
 *
 * @param props - See {@link ContextSheetProps}.
 * @returns The sheet's content, top to bottom.
 *
 * Side effects: none.
 */
export function ContextSheet({ badge, chrome = 'full', testID }: ContextSheetProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const tint = theme.badge.context.tint;
  const { payload, anchor } = badge;

  return (
    <View style={sheetStyles.sheet} testID={testID ?? 'context-sheet'}>
      {chrome === 'body' ? null : (
        <SheetHeading
          eyebrow="Context"
          tint={tint}
          title="Background for this passage"
          reference={verseLabel(anchor.verse)}
        />
      )}

      {payload.audioOverview === undefined ? null : (
        <SheetSection eyebrow="Audio overview" badgeTint={tint} testID="context-audio">
          <Text style={styles.audioHosts}>{payload.audioOverview.hostNames.join(' & ')}</Text>
          <Text style={styles.audioMeta}>
            {`${String(Math.round(payload.audioOverview.durationSeconds / 60))} min overview`}
          </Text>
        </SheetSection>
      )}

      <SheetSection
        eyebrow="What you need to know"
        badgeTint={tint}
        testID="context-summary"
      >
        <Text style={styles.summary}>{payload.summary}</Text>
        <GroundingMeter confidence={payload.groundingConfidence} tint={tint} />
        {payload.groundingConfidence === 'low' ? (
          <CaveatNote
            label="Low grounding confidence"
            body={LOW_CONFIDENCE_BODY}
            tint={theme.state.danger}
            testID="context-low-confidence"
          />
        ) : null}
      </SheetSection>

      {payload.suggestedQuestions.length === 0 ? null : (
        <SheetSection eyebrow="Ask about this passage" badgeTint={tint} testID="context-questions">
          <View style={styles.chipRow}>
            {payload.suggestedQuestions.map((question) => (
              <View key={question} style={styles.chip}>
                <Text style={styles.chipText}>{question}</Text>
              </View>
            ))}
          </View>
        </SheetSection>
      )}

      {chrome === 'body' ? null : (
        <SourceStrip sources={badge.sources} testID="context-sources" />
      )}
    </View>
  );
}

const sheetStyles = StyleSheet.create({ sheet: { gap: spacing.xl } });

const useStyles = createThemedStyles((theme: Theme) => ({
  audioHosts: { ...uiText('sm', 'semiBold'), color: theme.ink.primary },
  audioMeta: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
  summary: { ...uiText('sm'), color: theme.ink.primary, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: borderWidth.hairline,
    borderColor: theme.line.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { ...uiText('sm'), color: theme.ink.primary },
}));
