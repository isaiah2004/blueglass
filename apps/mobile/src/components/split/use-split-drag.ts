/**
 * The split's gesture and its animated width.
 *
 * Purpose
 *   Everything about dragging the divider that is *not* markup: the shared values, the pan
 *   gesture, the layout probe, and the animated style that turns the width into a real one.
 *   Kept apart from `ResizableSplit` so the component is a layout and this is a behaviour,
 *   and so neither file has to be read to change the other.
 *
 * The technique being preserved
 *   `resizable_split.dart:44-50` derives the pane width from the **absolute pointer
 *   position**, never from accumulated deltas: drag past a clamp and back, and an
 *   accumulator has drifted, so the handle is no longer under the cursor. `Pan`'s
 *   `translationX` looks like the same number and is not — it is relative to the gesture's
 *   own view, and this view *moves* as the pane resizes. Measured in a browser: a drag out
 *   past the minimum and back to its start returned a 480 dp rail as 736 dp. `absoluteX` is
 *   a page coordinate and cannot drift; with it, the same drag returns to 540 dp exactly.
 *
 * Why the width never touches React state
 *   The prototype learned this twice — `_ReaderWithRail` keeps the drag width in a local
 *   `ValueNotifier` and only commits on release (`app_shell.dart:344-398`), because
 *   committing per frame rebuilt its entire shell. Here the width lives in a Reanimated
 *   shared value, so a drag causes **no React render at all**; `onCommit` fires once.
 *
 * Dependencies
 *   `react-native-gesture-handler`, `react-native-reanimated`, and the tested arithmetic in
 *   `./split-geometry`.
 */

import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import {
  clampPaneWidth,
  paneWidthFromDrag,
  type SplitBounds,
  type SplitEdge,
} from './split-geometry';

/** What {@link useSplitDrag} needs to know. */
export interface SplitDragOptions {
  /** Which side the resizable pane is on. */
  readonly edge: SplitEdge;
  /** Where the divider starts, in dp. */
  readonly initialWidth: number;
  /** The narrowest the resizable pane may become, in dp. */
  readonly minPane: number;
  /** The narrowest the other pane may become, in dp. */
  readonly minOther: number;
  /** The divider's hit width, in dp. */
  readonly handleWidth: number;
  /** Called once, on release, with the final width. */
  readonly onCommit?: ((width: number) => void) | undefined;
}

/** What {@link useSplitDrag} hands back. */
export interface SplitDrag {
  /** Attach to a `GestureDetector` around the divider. */
  readonly gesture: PanGesture;
  /** Put on the resizable pane. Its `width` is clamped on the UI thread. */
  readonly paneStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  /** `1` while the divider is being held. Drives the handle's own appearance. */
  readonly isActive: SharedValue<number>;
  /** Put on the split's container so the bounds can be measured. */
  readonly onLayout: (event: LayoutChangeEvent) => void;
}

/**
 * Build a worklet that reports the split's current bounds.
 *
 * A worklet, so both the gesture and the layout style can call it on the UI thread.
 * `containerWidth` stays a shared value, which is what makes the pane re-clamp when a window
 * is dragged narrower — with no effect and no React render.
 *
 * @param containerWidth - The split's measured width, as a shared value.
 * @param options - The fixed sizes, from {@link SplitDragOptions}.
 * @returns A worklet returning the current {@link SplitBounds}.
 */
function boundsReader(
  containerWidth: SharedValue<number>,
  { handleWidth, minPane, minOther }: SplitDragOptions,
): () => SplitBounds {
  return (): SplitBounds => {
    'worklet';
    return { containerWidth: containerWidth.value, handleWidth, minPane, minOther };
  };
}

/**
 * Wire up a draggable divider.
 *
 * @param options - See {@link SplitDragOptions}.
 * @returns The gesture, the pane's animated style, and the layout probe.
 *
 * Side effects: calls `onCommit` on the JavaScript thread when the gesture ends.
 */
export function useSplitDrag(options: SplitDragOptions): SplitDrag {
  const { edge, initialWidth, onCommit } = options;
  const containerWidth = useSharedValue(0);
  const paneWidth = useSharedValue(initialWidth);
  const widthAtDragStart = useSharedValue(initialWidth);
  const pointerAtDragStart = useSharedValue(0);
  const isActive = useSharedValue(0);

  // Declared before `useAnimatedStyle` on purpose: the hooks linter reads that call as an
  // effect, and refuses a write to a value the effect reads if the write comes after it.
  const onLayout = (event: LayoutChangeEvent): void => {
    containerWidth.value = event.nativeEvent.layout.width;
  };
  const currentBounds = boundsReader(containerWidth, options);

  const gesture = Gesture.Pan()
    .onBegin((event) => {
      isActive.value = 1;
      widthAtDragStart.value = paneWidth.value;
      pointerAtDragStart.value = event.absoluteX;
    })
    .onUpdate((event) => {
      paneWidth.value = paneWidthFromDrag(
        widthAtDragStart.value,
        event.absoluteX - pointerAtDragStart.value,
        edge,
        currentBounds(),
      );
    })
    .onFinalize(() => {
      isActive.value = 0;
      if (onCommit !== undefined) runOnJS(onCommit)(paneWidth.value);
    });

  const paneStyle = useAnimatedStyle<ViewStyle>(() => ({
    width: clampPaneWidth(paneWidth.value, currentBounds()),
  }));

  return { gesture, paneStyle, isActive, onLayout };
}
