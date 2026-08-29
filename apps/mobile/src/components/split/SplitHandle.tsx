/**
 * SplitHandle.
 *
 * Purpose
 *   The divider itself: a wide, invisible hit area with a thin visible rule down the middle
 *   that thickens and takes the cyan accent while it is being held. Ports
 *   `resizable_split.dart:76-92`, including the two sizes it settled on.
 *
 * Why the hit area and the rule are different widths
 *   A 1 px rule is the right *look* and an impossible *target*. The hit area is a dozen
 *   pixels wide and the rule is drawn inside it, which is the same trade the prototype made
 *   and the reason its divider felt reliable on a trackpad.
 *
 * Reduced motion
 *   The rule's thickening is driven by the motion tokens, so it collapses to the cross-fade
 *   duration along with everything else. There is nothing to suppress in the drag itself:
 *   the divider tracks the pointer exactly, with no animation between.
 */

import type { JSX } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';

import { radius, type Theme } from '@/theme';
import { createThemedStyles, useMotion, useTheme } from '@/theme/runtime';

/** Inputs to {@link SplitHandle}. */
export interface SplitHandleProps {
  /** The pan gesture from `useSplitDrag`. */
  readonly gesture: PanGesture;
  /** `1` while the divider is held. */
  readonly isActive: SharedValue<number>;
  /** The hit area's width, in dp. */
  readonly width: number;
  /** What a screen reader calls the divider. */
  readonly accessibilityLabel: string;
  /** Test hook. */
  readonly testID: string;
}

/**
 * The web-only resize cursor.
 *
 * React Native's `ViewStyle` enumerates only `auto` and `pointer`, because those are the two
 * every platform has. `col-resize` is a real and expected affordance in a desktop browser —
 * decision `T-01` made that a first-class target — and react-native-web passes the value
 * straight through to CSS. The assertion is confined to this one constant.
 */
const RESIZE_CURSOR: ViewStyle | null =
  Platform.OS === 'web' ? ({ cursor: 'col-resize' } as unknown as ViewStyle) : null;

/** The resting thickness of the visible rule, in dp. */
const RULE_RESTING = 1;

/** Its thickness while held (`resizable_split.dart:84-88` used 3). */
const RULE_ACTIVE = 3;

/**
 * The draggable divider.
 *
 * @param props - See {@link SplitHandleProps}.
 * @returns The handle.
 *
 * Side effects: none; the gesture's effects belong to `useSplitDrag`.
 */
export function SplitHandle({
  gesture,
  isActive,
  width,
  accessibilityLabel,
  testID,
}: SplitHandleProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const motion = useMotion();

  const ruleStyle = useAnimatedStyle(() => ({
    width: withTiming(isActive.value === 1 ? RULE_ACTIVE : RULE_RESTING, {
      duration: motion.duration.press,
    }),
    backgroundColor: isActive.value === 1 ? theme.accent.cyan : theme.line.strong,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.handle, RESIZE_CURSOR, { width }]}
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <Animated.View style={[styles.rule, ruleStyle]} />
      </View>
    </GestureDetector>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  handle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background.canvas,
  },
  rule: { alignSelf: 'center', height: '100%', borderRadius: radius.pill },
}));
