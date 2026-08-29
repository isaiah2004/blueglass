/**
 * One verse's text, with its inline badges spliced in.
 *
 * Purpose
 *   Renders the segment run `model/verse-badges` produced as a single `<Text>`, so the
 *   scripture keeps one uninterrupted text flow: line breaking, justification, and — on
 *   the web — drag-selection all behave as if the badges were not there. That single-Text
 *   requirement is why `InlineBadge` is built the way it is (architecture decision A-1).
 *
 * Theming
 *   `InlineBadge` reads the active palette through `useTheme()`, and so does the annotated
 *   word this file tints. Both are therefore correct under the light theme as well as the
 *   dark one (`D-01`). The M1 note that lived here — that the pill kept its dark hues because
 *   the component read the module-scope colour table — is fixed, not merely inherited.
 *
 * Dependencies
 *   `@/components/InlineBadge`, the reader's theme hook, and the segmenting model.
 *   No data, no navigation.
 */

import type { JSX } from 'react';
import { Text, type GestureResponderEvent, type TextStyle } from 'react-native';

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
   * Called when a badge is tapped, with the badge's own id.
   *
   * Omitting it makes every pill in the verse decorative — which is what a pill whose badge
   * carries no id must be anyway, because there would be nothing for it to open.
   */
  readonly onBadgePress?: (badgeId: string) => void;
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
        const badgeId = segment.badgeId;
        return (
          <InlineBadge
            key={segment.id}
            kind={segment.kind}
            scriptureStep={scriptureStep}
            testID={`inline-badge-${segment.id}`}
            {...(segment.label === undefined ? {} : { label: segment.label })}
            {...(onBadgePress === undefined || badgeId === undefined
              ? {}
              : {
                  onPress: (event: GestureResponderEvent) => {
                    // The verse row is itself a control. Without this, tapping a pill would
                    // open the badge AND select the verse under it — two surfaces for one tap.
                    event.stopPropagation();
                    onBadgePress(badgeId);
                  },
                })}
          />
        );
      })}
    </Text>
  );
}
