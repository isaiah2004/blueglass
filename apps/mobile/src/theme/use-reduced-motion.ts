/**
 * The reader's reduced-motion setting.
 *
 * Purpose
 *   `docs/product/design-language.md` §6 requires the app to respect
 *   `prefers-reduced-motion` by replacing movement with a cross-fade, and `motion.ts`
 *   already ships the two token sets. This is the missing half: which set is in force.
 *
 * Why it is a hook and not a module constant
 *   The setting changes at runtime. On the web it is a live `matchMedia` query, which a
 *   reader can flip in their OS with the app already open; react-native-web wires that
 *   through `AccessibilityInfo`'s `reduceMotionChanged` event, so subscribing costs one
 *   listener and gets it right.
 *
 * The default before the first read resolves is **motion on** (`false`), matching the
 * platform default. The initial query resolves within a frame, so the exposure is one
 * frame of a 150 ms transition at worst.
 *
 * Dependencies
 *   React Native's `AccessibilityInfo`, and `./motion` for the token sets.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { motionFor, type MotionTokens } from './motion';

/**
 * Whether the reader has asked for reduced motion.
 *
 * @returns True when motion should be replaced by a cross-fade.
 *
 * Side effects: subscribes to the platform's `reduceMotionChanged` event for the life of
 * the component.
 */
export function useIsReduceMotionEnabled(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isCurrent) setIsEnabled(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsEnabled);

    return (): void => {
      isCurrent = false;
      subscription.remove();
    };
  }, []);

  return isEnabled;
}

/**
 * The motion tokens in force.
 *
 * @returns {@link motion} normally, {@link reducedMotion} when the reader has asked for
 *   less. Components read durations and easings from here rather than importing either
 *   set directly.
 */
export function useMotion(): MotionTokens {
  return motionFor(useIsReduceMotionEnabled());
}
