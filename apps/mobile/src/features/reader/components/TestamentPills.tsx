/**
 * The navigator's All / Old / New filter.
 *
 * Purpose
 *   Step one of the two-step picker (`flutter-port-map.md` §7.6). Three pills, one active,
 *   narrowing 66 books to 39 or 27 before the reader has typed anything — which is the
 *   whole reason the picker is two steps rather than one long list.
 *
 * Why `tab` rather than `radio`
 *   These filter a list that is already on screen rather than choosing a value to submit,
 *   and `tab` is what a screen reader announces usefully for that: "All, tab, 1 of 3,
 *   selected".
 *
 * Dependencies
 *   `@/theme`, `@/theme/runtime`, and the book-filter model's own list of filters.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidth, radius, size, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { TESTAMENT_FILTERS, testamentLabel, type TestamentFilter } from '../model/book-filter';
import { tint } from '../styles/tint';

/** What the pill row needs. */
export interface TestamentPillsProps {
  readonly value: TestamentFilter;
  readonly onChange: (filter: TestamentFilter) => void;
}

/** Opacity of the fill behind the active pill. */
const ACTIVE_FILL_ALPHA = 0.14;

/**
 * Render the three filter pills.
 *
 * @param props - See {@link TestamentPillsProps}.
 * @returns The pill row. Side effects: none beyond `onChange`.
 */
export function TestamentPills({ value, onChange }: TestamentPillsProps): JSX.Element {
  const theme = useTheme();

  return (
    <View style={styles.pills} accessibilityRole="tablist">
      {TESTAMENT_FILTERS.map((filter) => {
        const active = filter === value;
        return (
          <Pressable
            key={filter}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            aria-selected={active}
            testID={`testament-${filter}`}
            onPress={() => {
              onChange(filter);
            }}
            style={[
              styles.pill,
              {
                borderColor: active ? theme.accent.goldDim : theme.line.hairline,
                backgroundColor: active ? tint(theme.accent.gold, ACTIVE_FILL_ALPHA) : undefined,
              },
            ]}
          >
            <Text
              style={[styles.label, { color: active ? theme.accent.gold : theme.ink.secondary }]}
            >
              {testamentLabel(filter)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', gap: spacing.sm },
  // `size.tapTarget`, not `size.control`: these are the picker's primary filter and they
  // measured 42x32, 47x32 and 54x32 — under the 44 dp minimum on both axes for two of the
  // three. A pill can look like a chip and still have to be hittable with a thumb.
  pill: {
    minHeight: size.tapTarget,
    minWidth: size.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },
  label: uiText('sm', 'medium'),
});
