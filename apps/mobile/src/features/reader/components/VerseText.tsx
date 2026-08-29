/**
 * One verse's text, with its inline badges spliced in.
 *
 * Purpose
 *   Renders the segment run `model/verse-badges` produced as a single `<Text>`, so the
 *   scripture keeps one uninterrupted text flow: line breaking, justification, and — on
 *   the web — drag-selection all behave as if the badges were not there. That single-Text
 *   requirement is why `InlineBadge` is built the way it is (architecture decision A-1).
 *
 * Known limitation, deliberately not worked around here
 *   `components/InlineBadge.tsx` reads the dark theme from `@/theme` at module scope, so a
 *   badge pill keeps its dark hues under the light theme. That component is owned
 *   elsewhere; the fix belongs there - it should read `useTheme()` from `@/theme/runtime`
 *   like every other component now does, rather than gain a second implementation here.
 *   The annotated word, which this file does own, is tinted from the *active* theme.
 *
 * Dependencies
 *   `@/components/InlineBadge`, the reader's theme hook, and the segmenting model.
 *   No data, no navigation.
 */

import type { JSX } from 'react';
import { Text, type TextStyle } from 'react-native';

import { InlineBadge } from '@/components/InlineBadge';
import type { ScriptureStep } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { segmentVerse, type VerseBadgeAnchor } from '../model/verse-badges';

/** What `VerseText` needs to render one verse. */
export interface VerseTextProps {
  /** The verse text, exactly as the translation prints it. */
  readonly text: string;
  /** Badges to place inside it. Empty until M2 wires the enrichment source. */
  readonly anchors?: readonly VerseBadgeAnchor[];
  /** The reading size in force, so a badge scales with the serif around it. */
  readonly scriptureStep: ScriptureStep;
  /** Style for the scripture itself. */
  readonly style: TextStyle;
  /**
   * Called when a badge is tapped. Omitted in M1: with no badge sheets built yet, a
   * pressable pill that does nothing is worse than one that is plainly decorative.
   */
  readonly onBadgePress?: (kind: string) => void;
}

/**
 * Render one verse.
 *
 * @param props - See {@link VerseTextProps}.
 * @returns A single `<Text>` containing the verse and any badges inside it.
 *
 * Side effects: none.
 */
export function VerseText({
  text,
  anchors = [],
  scriptureStep,
  style,
  onBadgePress,
}: VerseTextProps): JSX.Element {
  const theme = useTheme();
  const segments = segmentVerse(text, anchors);

  return (
    <Text style={style} selectable>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <Text key={`t${String(index)}`}>{segment.text}</Text>;
        }
        if (segment.type === 'word') {
          return (
            <Text key={`w${String(index)}`} style={{ color: theme.badge[segment.kind].tint }}>
              {segment.text}
            </Text>
          );
        }
        return (
          <InlineBadge
            key={segment.id}
            kind={segment.kind}
            scriptureStep={scriptureStep}
            {...(segment.label === undefined ? {} : { label: segment.label })}
            {...(onBadgePress === undefined
              ? {}
              : {
                  onPress: () => {
                    onBadgePress(segment.kind);
                  },
                })}
          />
        );
      })}
    </Text>
  );
}
