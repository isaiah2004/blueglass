/**
 * SegmentedControl.
 *
 * Purpose
 *   A small group of mutually exclusive options sharing one track — the shape the mockups
 *   use for the sheet's tabs, the Studio toggle, and the theme switcher. Ports the
 *   prototype's `PillToggle` (`widgets/atoms.dart`) and, with it, the one detail worth
 *   copying: every control in the app that is "one row of small buttons" shares a single
 *   height token, so unrelated control groups line up down the page
 *   (`docs/architecture/flutter-port-map.md` §6, `LampSize.control`).
 *
 * Responsibilities
 *   - Owns: the track, the selected segment's fill, the press target, and the
 *     radio-group accessibility contract.
 *   - Does NOT own: what the options mean. It is generic over a string union, so a caller
 *     cannot pass a value that is not one of its own options.
 *
 * Accessibility
 *   `radiogroup` / `radio` rather than `tablist` / `tab`: these change a setting, they do
 *   not navigate. Each segment is at least 32 dp tall inside a 44 dp row, and carries its
 *   own label, so a screen reader announces "Light, radio button, 2 of 3".
 */

import type { JSX } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { borderWidth, radius, size, spacing, uiText, withOpacity, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** One selectable option. */
export interface SegmentOption<Value extends string> {
  /** The value this segment selects. */
  readonly value: Value;
  /** The visible label. */
  readonly label: string;
  /** What a screen reader announces. Defaults to the visible label. */
  readonly accessibilityLabel?: string | undefined;
}

/** Inputs to {@link SegmentedControl}. */
export interface SegmentedControlProps<Value extends string> {
  /** The options, in display order. */
  readonly options: readonly SegmentOption<Value>[];
  /** Which option is selected. */
  readonly value: Value;
  /** Called with the newly selected value. */
  readonly onChange: (value: Value) => void;
  /** What the group as a whole is called, e.g. "Theme". */
  readonly accessibilityLabel: string;
  /** Test hook applied to the track. */
  readonly testID?: string | undefined;
}

/** Opacity of the selected segment's fill. */
const SELECTED_FILL_ALPHA = 0.14;

/** Opacity of the selected segment's edge. */
const SELECTED_EDGE_ALPHA = 0.45;

/** Opacity of a segment while held down. */
const PRESSED_OPACITY = 0.62;

/**
 * A row of mutually exclusive options.
 *
 * @param props - See {@link SegmentedControlProps}.
 * @returns The control.
 *
 * Side effects: none beyond the caller's `onChange`.
 */
export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedControlProps<Value>): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);

  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => {
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            // Explicit as well as via `accessibilityState`: react-native-web does not derive
            // `aria-checked` from the state object, and a radio group where nothing is
            // checked is worse than no radio group at all.
            aria-checked={isSelected}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            testID={`${testID ?? 'segment'}-${option.value}`}
            style={({ pressed }) => [
              styles.segment,
              isSelected ? styles.segmentSelected : null,
              pressed && { opacity: PRESSED_OPACITY },
            ]}
          >
            <Text style={[styles.label, isSelected ? styles.labelSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: theme.line.hairline,
    backgroundColor: theme.background.card,
    ...Platform.select({ web: { userSelect: 'none' as const }, default: {} }),
  },
  segment: {
    minHeight: size.control,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: 'transparent',
  },
  segmentSelected: {
    backgroundColor: withOpacity(theme.accent.cyan, SELECTED_FILL_ALPHA),
    borderColor: withOpacity(theme.accent.cyan, SELECTED_EDGE_ALPHA),
  },
  // `ink.secondary`, not `ink.tertiary`: 13 pt is normal text and `Q-017` measured
  // tertiary below WCAG AA at that size in both themes.
  label: { ...uiText('sm', 'medium'), color: theme.ink.secondary },
  labelSelected: { color: theme.accent.cyan },
}));
