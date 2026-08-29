/**
 * TextualSheet — one entry point for the three textual badges, and the `AI-05` gate.
 *
 * Purpose
 *   The reader host should not have to know that `[Root]`, `[History]` and `[Cross-Ref]`
 *   are three components with three prop shapes. It narrows on `kind` here, once, and every
 *   sheet below receives an already-narrowed badge.
 *
 * The gate is the point of this component
 *   Decision `AI-05`: a badge that cannot name its source and licence is not rendered. That
 *   rule is applied here rather than in each sheet, because a rule repeated in three places
 *   is a rule that will be forgotten in the fourth. If provenance is missing, nothing from
 *   the payload reaches the screen — not the lemma, not the timeline, not one verse of a
 *   cross-reference — and the reader is told why rather than shown a blank sheet.
 *
 *   The server enforces the same rule before the badge reaches the wire. This is not
 *   redundancy: the server's guarantee covers what it sent, and the sheet also renders from
 *   a persisted query cache, a deep link and a fixture, none of which the server checked
 *   this session.
 *
 * Responsibilities
 *   - Owns: the gate, and the mapping from `kind` to component.
 *   - Does NOT own: the sheet chrome. There is no `Modal` and no `ScrollView` here. On a
 *     phone the host wraps this in `ReaderSheet` over the bottom half of the screen; at and
 *     above 600 dp it renders in the context rail beside the scripture (`Q-006`). Both work
 *     because this is a body and nothing else.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { CrossRefSheet } from './crossref/CrossRefSheet';
import { CulturalSheet } from './cultural/CulturalSheet';
import { ContextSheet } from './context/ContextSheet';
import { HistorySheet } from './history/HistorySheet';
import { LineageSheet } from './lineage/LineageSheet';
import { ManuscriptSheet } from './manuscript/ManuscriptSheet';
import { MeditateSheet } from './meditate/MeditateSheet';
import { UNATTRIBUTED_COPY, hasProvenance } from './model/provenance';
import type { SheetChrome } from './model/sheet-chrome';
import type { TextualBadge } from './model/textual-payloads';
import type { VerseTarget } from './model/verse-target';
import { RootSheet } from './root/RootSheet';
import { StructureSheet } from './structure/StructureSheet';

/** Inputs to {@link TextualSheet}. */
export interface TextualSheetProps {
  /** The badge to render. */
  readonly badge: TextualBadge;
  /** The anchored verse's text, used by the `[Root]` sheet's example row. */
  readonly verseText?: string | undefined;
  /** Open a passage in the reader. The host decides whether the sheet dismisses first. */
  readonly onOpenVerse?: ((target: VerseTarget) => void) | undefined;
  /**
   * `full` (the default) draws each sheet's heading and source strip; `body` omits both,
   * for a host such as `features/reader/badges/BadgeDetail` that already draws them.
   *
   * The `AI-05` refusal below is NOT suppressed by `body`. See `model/sheet-chrome.ts`.
   */
  readonly chrome?: SheetChrome;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * Render one textual badge's sheet body.
 *
 * @param props - See {@link TextualSheetProps}.
 * @returns The sheet body, or the refusal notice when the badge carries no printable
 *   provenance.
 *
 * Side effects: none beyond `onOpenVerse` and the flashcard save.
 */
export function TextualSheet({
  badge,
  verseText,
  onOpenVerse,
  chrome = 'full',
  testID,
}: TextualSheetProps): JSX.Element {
  if (!hasProvenance(badge.sources)) {
    return <UnattributedNotice testID={testID} />;
  }

  switch (badge.kind) {
    case 'root':
      return (
        <RootSheet
          badge={badge}
          verseText={verseText}
          onOpenVerse={onOpenVerse}
          chrome={chrome}
          {...(testID === undefined ? {} : { testID })}
        />
      );
    case 'history':
      return (
        <HistorySheet badge={badge} chrome={chrome} {...(testID === undefined ? {} : { testID })} />
      );
    case 'cross-ref':
      return (
        <CrossRefSheet
          badge={badge}
          onOpenVerse={onOpenVerse}
          chrome={chrome}
          {...(testID === undefined ? {} : { testID })}
        />
      );
    case 'lineage':
      return (
        <LineageSheet
          badge={badge}
          onOpenVerse={onOpenVerse}
          chrome={chrome}
          {...(testID === undefined ? {} : { testID })}
        />
      );
    case 'manuscript':
      return (
        <ManuscriptSheet badge={badge} chrome={chrome} {...(testID === undefined ? {} : { testID })} />
      );
    case 'structure':
      return (
        <StructureSheet badge={badge} chrome={chrome} {...(testID === undefined ? {} : { testID })} />
      );
    case 'cultural':
      return (
        <CulturalSheet badge={badge} chrome={chrome} {...(testID === undefined ? {} : { testID })} />
      );
    case 'meditate':
      return (
        <MeditateSheet badge={badge} chrome={chrome} {...(testID === undefined ? {} : { testID })} />
      );
    case 'context':
      return (
        <ContextSheet badge={badge} chrome={chrome} {...(testID === undefined ? {} : { testID })} />
      );
  }
}

/**
 * What is shown in place of an unattributed payload.
 *
 * @param props.testID - Test hook.
 * @returns The notice.
 *
 * Side effects: none.
 */
function UnattributedNotice({ testID }: { readonly testID?: string | undefined }): JSX.Element {
  const theme = useTheme();

  return (
    <View style={styles.notice} testID={testID ?? 'textual-sheet-unattributed'}>
      <Text style={[styles.copy, { color: theme.ink.secondary }]}>{UNATTRIBUTED_COPY}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { gap: spacing.md, paddingVertical: spacing.lg },
  copy: uiText('md'),
});
