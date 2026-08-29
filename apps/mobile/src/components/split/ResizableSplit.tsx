/**
 * ResizableSplit.
 *
 * Purpose
 *   Two panes and a draggable divider. Port-map **risk #5**: React Native has no split pane,
 *   and `Q-006` put the reader's resizable context rail and the desktop Studio canvas back
 *   in scope. This is the mitigation the map specifies — `react-native-gesture-handler`
 *   `Pan` plus a Reanimated shared value driving a `width` style.
 *
 * Responsibilities
 *   - Owns: which pane sits on which side, and nothing else.
 *   - Does NOT own: the drag (`./use-split-drag`), the divider's appearance
 *     (`./SplitHandle`), or the arithmetic (`./split-geometry`, tested at every boundary
 *     including a drag far out of range and back).
 *
 * Both edges
 *   The prototype needed a leading pane (desktop Ask) and a trailing one (the reader's
 *   context rail, `app_shell.dart:386-391`). Here the edge is a parameter, so the clamp is
 *   written — and tested — once.
 */

import type { JSX, ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { createThemedStyles, useTheme } from '@/theme/runtime';

import { resolvePaneWidth, type SplitEdge } from './split-geometry';
import { SplitHandle } from './SplitHandle';
import { useSplitDrag } from './use-split-drag';

/** Inputs to {@link ResizableSplit}. */
export interface ResizableSplitProps {
  /** The pane that keeps a fixed, draggable width. */
  readonly resizable: ReactNode;
  /** The pane that takes the remaining room. */
  readonly flexible: ReactNode;
  /** Which side the resizable pane is on. */
  readonly edge: SplitEdge;
  /** Where the divider starts, in dp. */
  readonly initialWidth: number;
  /** The narrowest the resizable pane may become, in dp. */
  readonly minPane: number;
  /** The narrowest the flexible pane may become, in dp. */
  readonly minOther: number;
  /** The divider's hit width, in dp. */
  readonly handleWidth: number;
  /** Called once, on release, with the final width — for persisting the reader's choice. */
  readonly onCommit?: ((width: number) => void) | undefined;
  /** What a screen reader calls the divider. */
  readonly accessibilityLabel: string;
  /** Test hook on the divider. Defaults to the harness's `reader-rail-handle`. */
  readonly handleTestID?: string | undefined;
  /** Test hook on the whole split. Defaults to the harness's `reader-split-pane`. */
  readonly testID?: string | undefined;
}

/**
 * Two panes with a draggable divider.
 *
 * @param props - See {@link ResizableSplitProps}.
 * @returns The split.
 *
 * Side effects: calls `onCommit` when a drag ends.
 */
export function ResizableSplit({
  resizable,
  flexible,
  edge,
  initialWidth,
  minPane,
  minOther,
  handleWidth,
  onCommit,
  accessibilityLabel,
  handleTestID = 'reader-rail-handle',
  testID = 'reader-split-pane',
}: ResizableSplitProps): JSX.Element {
  const styles = useStyles(useTheme());
  const drag = useSplitDrag({ edge, initialWidth, minPane, minOther, handleWidth, onCommit });

  const pane = <Animated.View style={drag.paneStyle}>{resizable}</Animated.View>;
  const rest = <View style={styles.flexible}>{flexible}</View>;

  return (
    <View style={styles.row} onLayout={drag.onLayout} testID={testID}>
      {edge === 'leading' ? pane : rest}
      <SplitHandle
        gesture={drag.gesture}
        isActive={drag.isActive}
        width={handleWidth}
        accessibilityLabel={accessibilityLabel}
        testID={handleTestID}
      />
      {edge === 'leading' ? rest : pane}
    </View>
  );
}

/** Re-exported so a caller can clamp a stored width before passing it in. */
export { resolvePaneWidth };

const useStyles = createThemedStyles(() => ({
  row: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  flexible: { flex: 1, minWidth: 0 },
}));
