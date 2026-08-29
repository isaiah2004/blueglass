/**
 * One search hit.
 *
 * Purpose
 *   A reference alone is not a result — a reader scanning forty hits needs to see *why*
 *   each matched, which means the verse text travels with it. The row is therefore two
 *   lines: the reference in the UI face, the verse in the scripture serif (`D-03`).
 *
 * Tap target
 *   The whole row is the control, and it is at least 44 dp tall (WCAG 2.5.8) whatever the
 *   verse's length, because a one-line hit is the common case and a one-line hit is exactly
 *   what a bare `Text` row makes 20 dp tall.
 *
 * Dependencies
 *   `@/api` for the hit type, `@/theme`, and the reader's theme hook.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { ApiSearchHit } from '@/api';
import { borderWidth, radius, scriptureText, size, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

/** What one result row needs. */
export interface SearchResultRowProps {
  readonly hit: ApiSearchHit;
  /** Zero-based position, which is the harness's handle on the row. */
  readonly index: number;
  readonly onPress: () => void;
}

/** How much of a long verse a result row shows before it stops being scannable. */
const PREVIEW_LINES = 3;

/** Opacity while the row is held down. */
const PRESSED_OPACITY = 0.7;

/**
 * Render one hit.
 *
 * @param props - See {@link SearchResultRowProps}.
 * @returns The row. Side effects: none beyond `onPress`.
 */
export function SearchResultRow({ hit, index, onPress }: SearchResultRowProps): JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${hit.reference}. ${hit.text}`}
      testID={`search-result-${String(index)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.line.hairline },
        pressed && { opacity: PRESSED_OPACITY },
      ]}
    >
      <Text style={[styles.reference, { color: theme.accent.gold }]}>{hit.reference}</Text>
      <Text numberOfLines={PREVIEW_LINES} style={[styles.text, { color: theme.ink.secondary }]}>
        {hit.text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: size.tapTarget,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.control,
  },
  reference: uiText('sm', 'semiBold'),
  text: scriptureText('sm'),
});
