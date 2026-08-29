/**
 * The reader's one button.
 *
 * Purpose
 *   Every control in the reader — the translation pill, the display button, the chapter
 *   pager, Retry — is the same object at three emphases. Building it once is what keeps
 *   the chrome quiet enough that scripture stays the loudest thing on screen, and it is
 *   also what stops a raw colour or radius appearing at a call site.
 *
 * Emphasis
 *   `quiet` is the default: a hairline outline on the canvas, ink-secondary label. `strong`
 *   fills with the gold accent because it is the reader's own action (§8.2). `ghost` is
 *   label-only, for the pager, where a border would fence off the scripture above it.
 *
 * Every button is a 44 dp target
 *   `hit` sets a minimum on **both** axes. Height alone was not enough: the display button
 *   measured 43x44 and the chapter pager's Next 39x44, both of which the tap-target audit
 *   correctly refused — a control a thumb misses is a control that is not there.
 *
 * Press feedback
 *   `design-language.md` §6 and `flutter-port-map.md` §7.7: a 120 ms scale to 0.96, in
 *   place of a platform ripple. Reduced motion drops the scale and keeps the opacity
 *   change, so the control still answers a touch.
 *
 * Dependencies
 *   The reader's theme hook plus the radius, spacing, motion and typography tokens.
 */

import type { JSX, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import {
  borderWidth,
  motionFor,
  radius,
  size,
  spacing,
  uiText,
  type Color,
  type Theme,
} from '@/theme';
import { useTheme } from '@/theme/runtime';

import { tint } from '../styles/tint';

/** How loud a button is. */
export type ReaderButtonEmphasis = 'quiet' | 'strong' | 'ghost';

/** What a reader button needs. */
export interface ReaderButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly emphasis?: ReaderButtonEmphasis;
  /** Small text above the label — the pager's "Previous" / "Next". */
  readonly overline?: string;
  readonly disabled?: boolean;
  readonly reduceMotion?: boolean;
  readonly testID?: string;
  /** Rendered before the label, inside the pill. */
  readonly leading?: ReactNode;
  readonly accessibilityLabel?: string;
  /**
   * Which end of its parent the label sits at.
   *
   * `'end'` also makes the control span its parent, which is what makes the chapter
   * pager's two halves the same size: Previous measured 173x44 and Next 39x44 for the same
   * weight of action, because only Next had been pushed to its edge with `alignItems`.
   */
  readonly align?: 'start' | 'end';
}

/** Scale a pressed control shrinks to (`flutter-port-map.md` §7.7). */
const PRESSED_SCALE = 0.96;

/** Opacity a disabled control fades to. */
const DISABLED_OPACITY = 0.4;

/** Opacity of the fill behind a `strong` button. */
const STRONG_FILL_ALPHA = 0.16;

/**
 * Render a button.
 *
 * @param props - See {@link ReaderButtonProps}.
 * @returns The control. Side effects: none beyond `onPress`.
 */
export function ReaderButton({
  label,
  onPress,
  emphasis = 'quiet',
  overline,
  disabled = false,
  reduceMotion = false,
  testID,
  leading,
  accessibilityLabel,
  align = 'start',
}: ReaderButtonProps): JSX.Element {
  const theme = useTheme();
  const scaleOnPress = motionFor(reduceMotion).transition === 'motion';
  const shell = shellStyle(theme, emphasis);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hit,
        align === 'end' ? styles.hitEnd : undefined,
        disabled ? { opacity: DISABLED_OPACITY } : undefined,
        pressed && !disabled
          ? { opacity: 0.8, transform: [{ scale: scaleOnPress ? PRESSED_SCALE : 1 }] }
          : undefined,
      ]}
    >
      <View style={[styles.pill, align === 'end' ? styles.pillEnd : undefined, shell.pill]}>
        {leading}
        <View>
          {overline === undefined ? null : (
            <Text
              style={[
                styles.overline,
                align === 'end' ? styles.textEnd : undefined,
                { color: theme.ink.tertiary },
              ]}
            >
              {overline}
            </Text>
          )}
          <Text
            numberOfLines={1}
            style={[styles.label, align === 'end' ? styles.textEnd : undefined, { color: shell.label }]}
          >
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The pill's surface and its label colour, for one emphasis.
 *
 * A `ghost` button has no surface at all — a border there would fence off the scripture
 * above the chapter pager, which is exactly what pillar 1 asks us not to do.
 *
 * @param theme - The theme in force.
 * @param emphasis - How loud the button is.
 * @returns The pill's style and the label's colour. Side effects: none.
 */
function shellStyle(
  theme: Theme,
  emphasis: ReaderButtonEmphasis,
): { readonly pill: ViewStyle; readonly label: Color } {
  if (emphasis === 'ghost') {
    return { pill: styles.ghost, label: theme.ink.secondary };
  }
  const strong = emphasis === 'strong';
  return {
    pill: {
      backgroundColor: strong ? tint(theme.accent.gold, STRONG_FILL_ALPHA) : undefined,
      borderColor: strong ? theme.accent.goldDim : theme.line.hairline,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.control,
    },
    label: strong ? theme.accent.gold : theme.ink.secondary,
  };
}

const styles = StyleSheet.create({
  hit: { minHeight: size.tapTarget, minWidth: size.tapTarget, justifyContent: 'center' },
  hitEnd: { alignSelf: 'stretch' },
  pillEnd: { justifyContent: 'flex-end' },
  textEnd: { textAlign: 'right' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: size.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  ghost: { paddingHorizontal: spacing.none },
  label: uiText('sm', 'medium'),
  overline: uiText('xs'),
});
