/**
 * RootSheet — the `[Root]` badge's sheet body.
 *
 * Purpose
 *   `docs/product/mockups/image6.png`, built from what the lexicon actually holds: the
 *   English word the reader tapped, the Greek or Hebrew word under it, the lexicon's sense,
 *   how rare the word is, the verse it was found in, and a way to keep it.
 *
 * Responsibilities
 *   - Owns: the order of the sheet's sections and the badge's hue.
 *   - Does NOT own: the sheet chrome. There is no `Modal` here, no grab handle, no close
 *     button and no scroll view. `design-language.md` §4 puts a sheet over the bottom half
 *     of a phone; `Q-006` puts the same content in the context rail above 600 dp. Both are
 *     the host's arrangement, and this body renders unchanged in either — the reason
 *     `VerseDetail` is shared between `VerseDock` and `ContextPanel` for exactly the same
 *     reason.
 *   - Does NOT own: whether it may render at all. `TextualSheet` applies the `AI-05`
 *     provenance gate before this component is reached.
 *
 * It does not scroll itself
 *   Both of its homes already scroll. A second scroller nested inside either measures zero
 *   height inside a scroll content container, which shows up as a blank sheet.
 *
 * Both themes
 *   Every colour resolves through `useTheme()`, and `theme.badge.root.tint` is the hue
 *   §2 assigns to this badge in both palettes (`D-01`).
 */

import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { SheetHeading } from '../chrome/SheetHeading';
import { SourceStrip } from '../chrome/SourceStrip';
import type { SheetChrome } from '../model/sheet-chrome';
import type { RootSheetBadge } from '../model/textual-payloads';
import { verseLabel, type VerseTarget } from '../model/verse-target';
import { FlashcardAction } from './FlashcardAction';
import { LemmaHeader } from './LemmaHeader';
import { RootExamples } from './RootExamples';
import { RootLexicon } from './RootLexicon';
import { languageLabel } from './original-language';
import { headlineSummary } from './root-usage';

/** Inputs to {@link RootSheet}. */
export interface RootSheetProps {
  /** The badge, envelope and payload. */
  readonly badge: RootSheetBadge;
  /** The anchored verse's text, when the host has it loaded. */
  readonly verseText?: string | undefined;
  /** Open a passage in the reader. */
  readonly onOpenVerse?: ((target: VerseTarget) => void) | undefined;
  /** `full` (the default) draws the heading and the source strip; `body` omits both. */
  readonly chrome?: SheetChrome;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * The `[Root]` sheet body.
 *
 * @param props - See {@link RootSheetProps}.
 * @returns The sheet's content, top to bottom.
 *
 * Side effects: none beyond `onOpenVerse` and the flashcard save.
 */
export function RootSheet({
  badge,
  verseText,
  onOpenVerse,
  chrome = 'full',
  testID,
}: RootSheetProps): JSX.Element {
  const theme = useTheme();
  const tint = theme.badge.root.tint;
  const { payload, anchor } = badge;

  return (
    <View style={styles.sheet} testID={testID ?? 'root-sheet'}>
      {chrome === 'body' ? null : (
        <SheetHeading
          eyebrow={`${languageLabel(payload.language)} root`}
          tint={tint}
          title={anchor.text}
          reference={verseLabel(anchor.verse)}
          summary={headlineSummary(payload, anchor.text)}
        />
      )}

      <LemmaHeader payload={payload} />

      <RootLexicon payload={payload} tint={tint} />

      <RootExamples
        payload={payload}
        verse={anchor.verse}
        verseText={verseText}
        onOpenVerse={onOpenVerse}
        tint={tint}
      />

      <FlashcardAction payload={payload} verseKey={anchor.verse.value} />

      {chrome === 'body' ? null : <SourceStrip sources={badge.sources} testID="root-sources" />}
    </View>
  );
}

const styles = StyleSheet.create({ sheet: { gap: spacing.xl } });
