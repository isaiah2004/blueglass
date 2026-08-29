/**
 * The badge mark, standing on its own outside the text flow.
 *
 * Purpose
 *   `InlineBadge` is an inline attachment: it must be a child of a `<Text>`, and outside one
 *   it becomes a block and takes its own line (`spike-inline-badges.md` §10). The chapter-end
 *   summary list and the sheet heading both need the same mark in an ordinary layout, so this
 *   is that mark as a plain view — the same brackets, the same glyph, the same hue.
 *
 * Deliberately not a second badge implementation
 *   The vocabulary comes from `@/components/InlineBadge.types`, so the pill in the summary
 *   list and the pill in the verse can never say different words or carry a different glyph.
 *   Only the layout mechanism differs, and that difference is the whole reason this file
 *   exists.
 *
 * Dependencies
 *   `@/components/InlineBadge.types` for the mark and `@/components/BadgeGlyph` for the icon,
 *   `@/theme` for the tokens, and the theme runtime for the active palette (`D-01`: correct
 *   in both).
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BADGE_ICON_SIZE_RATIO } from '@/components/badge-icons';
import { BadgeGlyph } from '@/components/BadgeGlyph';
import { splitBadgeMark } from '@/components/InlineBadge.types';
import { borderWidth, fontFamily, radius, size, spacing, uiSize } from '@/theme';
import { useTheme } from '@/theme/runtime';
import type { BadgeKind } from '@/theme';

/** What the pill needs. */
export interface BadgePillProps {
  readonly kind: BadgeKind;
  /** Overrides the kind's default label. */
  readonly label?: string | undefined;
  readonly testID?: string | undefined;
}

/**
 * Render one badge mark as a standalone pill.
 *
 * @param props - See {@link BadgePillProps}.
 * @returns The pill. Side effects: none — it is not a control; its row is.
 */
export function BadgePill({ kind, label, testID }: BadgePillProps): JSX.Element {
  const palette = useTheme().badge[kind];
  const mark = splitBadgeMark(kind, label);

  return (
    <View
      testID={testID}
      style={[styles.pill, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <Text numberOfLines={1} style={[styles.label, { color: palette.tint }]}>
        {mark.lead}
      </Text>
      <BadgeGlyph kind={kind} size={GLYPH_SIZE} color={palette.tint} />
      <Text numberOfLines={1} style={[styles.label, styles.word, { color: palette.tint }]}>
        {mark.word}
        {mark.tail}
      </Text>
    </View>
  );
}

/** The glyph's box beside a `uiSize.xs` label — the same optical ratio the inline pill uses. */
const GLYPH_SIZE = Math.round(uiSize.xs * BADGE_ICON_SIZE_RATIO);

const styles = StyleSheet.create({
  pill: {
    height: size.badge,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    // A pill never squeezes to fit; the row around it wraps or truncates instead.
    flexShrink: 0,
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  label: {
    fontFamily: fontFamily.ui.semiBold,
    fontWeight: '600',
    fontSize: uiSize.xs,
  },
  /** The gap between the glyph and the word. */
  word: { marginLeft: spacing.xs },
});
