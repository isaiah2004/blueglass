/**
 * One selectable row inside a reader sheet.
 *
 * Purpose
 *   The translation switcher and the display sheet both present a list where exactly one
 *   item is chosen. Sharing the row keeps the selected state — a gold check and a gold
 *   label, because choosing is the reader's own act (§8.2) — identical in both, and gives
 *   the pair a single place to be made accessible.
 *
 * Accessibility
 *   The row reports `radio` with a `selected` state rather than `button`, which is what
 *   lets a screen reader announce "2 of 4, selected" instead of leaving the reader to
 *   infer the grouping from the visual check.
 *
 * Dependencies
 *   The reader's theme hook and the radius, spacing and typography tokens.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidth, radius, size, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { tint } from '../styles/tint';

/** What one option row shows. */
export interface OptionRowProps {
  readonly label: string;
  /** Second line, e.g. a translation's language or licence note. */
  readonly detail?: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}

/** Opacity of the fill behind the chosen row. */
const SELECTED_FILL_ALPHA = 0.1;

/**
 * Render one option.
 *
 * @param props - See {@link OptionRowProps}.
 * @returns The row. Side effects: none beyond `onPress`.
 */
export function OptionRow({
  label,
  detail,
  selected,
  onPress,
  testID,
}: OptionRowProps): JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      // react-native-web does not map `accessibilityState.selected` onto a radio, so the
      // web target — which `T-01` makes first-class — needs the ARIA attribute directly.
      // Both are set: the first is what Android reads, the second is what a browser
      // screen reader reads.
      aria-checked={selected}
      accessibilityLabel={detail === undefined ? label : `${label}, ${detail}`}
      testID={testID}
      onPress={onPress}
      style={[
        styles.row,
        {
          borderColor: selected ? theme.accent.goldDim : theme.line.hairline,
          backgroundColor: selected
            ? tint(theme.accent.gold, SELECTED_FILL_ALPHA)
            : theme.background.card,
        },
      ]}
    >
      <View style={styles.text}>
        <Text style={[styles.label, { color: selected ? theme.accent.gold : theme.ink.primary }]}>
          {label}
        </Text>
        {detail === undefined ? null : (
          <Text style={[styles.detail, { color: theme.ink.secondary }]}>{detail}</Text>
        )}
      </View>
      {selected ? (
        <Text accessibilityElementsHidden style={[styles.check, { color: theme.accent.gold }]}>
          {'✓'}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: size.tapTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.control,
  },
  text: { flex: 1, gap: spacing.xs },
  label: uiText('md', 'medium'),
  detail: uiText('sm'),
  check: uiText('md', 'semiBold'),
});
