/**
 * The navigator's search field.
 *
 * Purpose
 *   The half of `flutter-port-map.md` §7.6 that makes the picker fast. Two behaviours are
 *   ported exactly: the query normalises away spaces and punctuation, so `1cor`, `1 Cor`
 *   and `songofsongs` all hit; and Enter goes straight to the first match, so typing four
 *   characters and pressing return is the entire navigation.
 *
 * Dependencies
 *   `@/theme`, `@/theme/runtime`. The matching itself is `model/book-filter`.
 */

import type { JSX } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { borderWidth, radius, size, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

/** What the field needs. */
export interface BookSearchFieldProps {
  readonly value: string;
  readonly onChange: (query: string) => void;
  /** Enter was pressed. The caller jumps to the first match. */
  readonly onSubmit: () => void;
}

/**
 * Render the search field.
 *
 * @param props - See {@link BookSearchFieldProps}.
 * @returns The field. Side effects: none beyond its callbacks.
 */
export function BookSearchField({ value, onChange, onSubmit }: BookSearchFieldProps): JSX.Element {
  const theme = useTheme();

  return (
    <TextInput
      testID="book-search"
      value={value}
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      placeholder="Search books"
      placeholderTextColor={theme.ink.tertiary}
      accessibilityLabel="Search books"
      returnKeyType="go"
      style={[
        styles.field,
        {
          color: theme.ink.primary,
          backgroundColor: theme.background.card,
          borderColor: theme.line.hairline,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    ...uiText('md'),
    minHeight: size.tapTarget,
    paddingHorizontal: spacing.md,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.control,
  },
});
