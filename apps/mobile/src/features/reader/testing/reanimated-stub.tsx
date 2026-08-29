/**
 * A minimal `react-native-reanimated` for component tests.
 *
 * Purpose
 *   Reanimated's real entry point loads `react-native-worklets`, whose package layout
 *   Node's ESM resolver cannot follow, so importing any animated component under Vitest
 *   fails before it renders. The animation itself is not what a component test can assert
 *   anyway — a timing curve is a device concern, and `docs/qa/` walkthroughs and Maestro
 *   are what cover it.
 *
 * What this stub preserves
 *   The *end state* of every animation. `withTiming(x)` returns `x`, and `useAnimatedStyle`
 *   simply runs its worklet. So a test still sees the exact colours the component asked
 *   for, which is what the verse row's assertions are about: the four tones, the constant
 *   footprint, and the fade endpoints that must never be transparent black.
 *
 * What it deliberately does not do
 *   No timing, no interpolation, no shared-value subscriptions. A test that needs those is
 *   testing Reanimated, not the reader.
 *
 * Usage
 *   ```ts
 *   vi.mock('react-native-reanimated', async () => (await import('../testing/reanimated-stub')).default);
 *   ```
 */

import { forwardRef, type ComponentProps, type JSX } from 'react';
import { ScrollView, Text, View } from 'react-native';

/** A worklet's result — whatever style object it returned. */
type StyleResult = Record<string, unknown>;

/** The subset of `useSharedValue`'s handle this stub supports. */
interface SharedValue<T> {
  value: T;
}

/**
 * Runs a style worklet immediately.
 *
 * @param factory - The worklet.
 * @returns Its result — the animation's end state. Side effects: none.
 */
function useAnimatedStyle(factory: () => StyleResult): StyleResult {
  return factory();
}

/**
 * A shared value that is just a box.
 *
 * @param initial - Starting value.
 * @returns A mutable holder. Side effects: none.
 */
function useSharedValue<T>(initial: T): SharedValue<T> {
  return { value: initial };
}

/**
 * The end state of a timed animation.
 *
 * @param toValue - Where the animation was headed.
 * @returns That value, immediately. Side effects: none.
 */
function withTiming<T>(toValue: T): T {
  return toValue;
}

/**
 * The end state of a repeated animation.
 *
 * @param animation - The animation being repeated.
 * @returns Its value. Side effects: none.
 */
function withRepeat<T>(animation: T): T {
  return animation;
}

/**
 * The end state of a spring.
 *
 * @param toValue - Where the spring was headed.
 * @returns That value, immediately. Side effects: none.
 */
function withSpring<T>(toValue: T): T {
  return toValue;
}

const AnimatedView = forwardRef<View, ComponentProps<typeof View>>(
  function AnimatedView(props, ref): JSX.Element {
    return <View ref={ref} {...props} />;
  },
);

const AnimatedText = forwardRef<Text, ComponentProps<typeof Text>>(
  function AnimatedText(props, ref): JSX.Element {
    return <Text ref={ref} {...props} />;
  },
);

const AnimatedScrollView = forwardRef<ScrollView, ComponentProps<typeof ScrollView>>(
  function AnimatedScrollView(props, ref): JSX.Element {
    return <ScrollView ref={ref} {...props} />;
  },
);

/** The default export the real module has: `Animated.View`, `Animated.Text`, and so on. */
const Animated = {
  View: AnimatedView,
  Text: AnimatedText,
  ScrollView: AnimatedScrollView,
};

/** The module shape `vi.mock` substitutes. */
export default {
  default: Animated,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSpring,
  Easing: { linear: (value: number): number => value },
};
