/**
 * InlineBadgeVerse — one verse of the spike passage, rendered by a chosen badge strategy.
 *
 * Purpose
 *   Holds the part of the spike that must be IDENTICAL across strategies: the gold verse
 *   number in its gutter, the serif at the requested size, the tinted annotated words, and
 *   the single `<Text>` that owns the paragraph. Only the badge node differs, so any visual
 *   difference on screen is attributable to the strategy and to nothing else.
 *
 * Why a strategy union rather than a render prop
 *   A render prop would let a caller pass a badge configured differently from the one under
 *   test, which is precisely the mistake this spike exists to avoid.
 *
 * Dependencies
 *   `@/theme`, the three in-text badge implementations, and `./InlineBadge.passage`.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, metadataText, scriptureText, size, spacing, type ScriptureStep } from '@/theme';

import { InlineBadge } from './InlineBadge';
import { InlineBadgeNestedText } from './InlineBadgeNestedText';
import { InlineBadgeSvg } from './InlineBadgeSvg';
import type { PassageVerse } from './InlineBadge.passage';
import type { BadgeKind } from '@/theme';

/** The three strategies that keep the verse as one flowing `<Text>`. */
export type InTextStrategy = 'inlineView' | 'nestedText' | 'svg';

/** Inputs to {@link InlineBadgeVerse}. */
export interface InlineBadgeVerseProps {
  /** The verse to render. */
  readonly verse: PassageVerse;
  /** Which badge implementation to use for this verse. */
  readonly strategy: InTextStrategy;
  /** The scripture size to render at. */
  readonly scriptureStep?: ScriptureStep;
}

/**
 * Render one badge with the strategy under test.
 *
 * @param strategy - Which implementation.
 * @param kind - The badge type.
 * @param step - The surrounding scripture size.
 * @param key - React key, since these are produced inside a map.
 * @returns The badge node.
 */
function renderBadge(
  strategy: InTextStrategy,
  kind: BadgeKind,
  step: ScriptureStep,
  key: number,
): JSX.Element {
  if (strategy === 'nestedText') {
    return <InlineBadgeNestedText key={key} kind={kind} scriptureStep={step} />;
  }
  if (strategy === 'svg') {
    return <InlineBadgeSvg key={key} kind={kind} scriptureStep={step} />;
  }
  return <InlineBadge key={key} kind={kind} scriptureStep={step} />;
}

/**
 * Render one verse: gold number in the gutter, serif body, badges inline.
 *
 * @param props - See {@link InlineBadgeVerseProps}.
 * @returns A verse row.
 *
 * Side effects: none.
 */
export function InlineBadgeVerse({
  verse,
  strategy,
  scriptureStep = 'md',
}: InlineBadgeVerseProps): JSX.Element {
  const body = scriptureText(scriptureStep);
  return (
    <View style={styles.row}>
      <Text style={styles.number}>{String(verse.number)}</Text>
      <Text style={[body, styles.body]}>
        {verse.segments.map((segment, index) => {
          if (segment.type === 'badge') {
            return renderBadge(strategy, segment.kind, scriptureStep, index);
          }
          const tint = segment.type === 'tinted' ? colors.badge[segment.kind].tint : undefined;
          return (
            <Text key={index} style={tint === undefined ? undefined : { color: tint }}>
              {segment.text}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  number: {
    ...metadataText('md'),
    color: colors.accent.gold,
    width: size.verseNumberGutter,
    textAlign: 'right',
  },
  body: {
    flex: 1,
    color: colors.ink.primary,
  },
});
