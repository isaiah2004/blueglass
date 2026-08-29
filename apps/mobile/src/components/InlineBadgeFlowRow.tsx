/**
 * InlineBadgeFlowRow — strategy D of the inline-badge spike. The escape hatch.
 *
 * Purpose
 *   Renders a verse without nesting anything inside a `<Text>` at all: the verse becomes a
 *   `flexWrap: 'wrap'` row of one `<Text>` per word, with each badge as a sibling `<View>`.
 *   Because nothing is an inline attachment, the pill is an ordinary view on every platform
 *   and the three renderers cannot disagree about it.
 *
 * Why it is the escape hatch and not the default
 *   - The paragraph is no longer text. Native text selection, copy, find-in-page, hyphenation
 *     and justification are gone, and a screen reader would read one word per gesture unless
 *     the row is given the whole verse as an `accessibilityLabel` (this component does).
 *   - Spaces are gone too. `columnGap` puts back a constant approximation of the space glyph,
 *     so inter-word spacing no longer tracks the face's real advance width, and punctuation
 *     that arrives as its own token floats away from the word it belongs to. A production
 *     version needs a tokeniser that glues punctuation to the preceding word.
 *   - One view per word. A chapter is 600-900 words; only virtualisation keeps that sane.
 *
 * When to reach for it
 *   If inline attachments turn out to be broken on a target platform — for example if a
 *   badge cannot be made tappable inside a `<Text>` on Android — this is the fallback that
 *   is guaranteed to render correctly, at the cost of the paragraph being a layout instead
 *   of a text.
 *
 * Dependencies
 *   `@/theme`, `./InlineBadge` for the pill itself, `./InlineBadge.geometry`,
 *   `./InlineBadge.passage` for the word expansion.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, scriptureText, type ScriptureStep } from '@/theme';

import { InlineBadge } from './InlineBadge';
import { badgeGeometry } from './InlineBadge.geometry';
import { toPlainText, toWords, type PassageSegment } from './InlineBadge.passage';

/** Inputs to {@link InlineBadgeFlowRow}. */
export interface InlineBadgeFlowRowProps {
  /** The verse to lay out. */
  readonly segments: readonly PassageSegment[];
  /** The scripture size to render at. */
  readonly scriptureStep?: ScriptureStep;
}

/**
 * Render one verse as a wrapping row of words and pills.
 *
 * @param props - See {@link InlineBadgeFlowRowProps}.
 * @returns A row that wraps between words, with every badge a real view.
 *
 * Side effects: none.
 */
export function InlineBadgeFlowRow({
  segments,
  scriptureStep = 'md',
}: InlineBadgeFlowRowProps): JSX.Element {
  const geometry = badgeGeometry(scriptureStep);
  const textStyle = scriptureText(scriptureStep);
  return (
    <View
      style={[styles.row, { columnGap: geometry.wordGap }]}
      accessible
      accessibilityLabel={toPlainText(segments)}
    >
      {toWords(segments).map((word, index) =>
        word.type === 'badge' ? (
          <InlineBadge
            key={index}
            kind={word.kind}
            scriptureStep={scriptureStep}
            alignment="flexBaseline"
          />
        ) : (
          <Text
            key={index}
            style={[
              textStyle,
              {
                color: word.kind === undefined ? colors.ink.primary : colors.badge[word.kind].tint,
              },
            ]}
          >
            {word.text}
          </Text>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // The one alignment that makes a 23 pt pill and a 32 pt line box share a baseline.
    // Yoga implements it for text nodes and CSS implements it per flex line, so this is the
    // rare style that means the same thing on all three platforms.
    alignItems: 'baseline',
  },
});
