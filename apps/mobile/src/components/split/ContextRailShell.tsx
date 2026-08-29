/**
 * ContextRailShell.
 *
 * Purpose
 *   The reading layout `Q-006` reinstated: scripture on the left, a context rail on the
 *   right, on any window wide enough to hold both. There are **three** regimes, not two,
 *   and collapsing them to two is the defect this component was rebuilt to fix — the rail
 *   was gated behind the 1100 dp split breakpoint, so the entire 600–1099 dp tablet band
 *   got the phone layout and `reader-context-rail` existed at no width at all.
 *
 *   | width | rail | divider |
 *   |---|---|---|
 *   | < 600 dp, or too narrow to fit | none — the same content belongs in a sheet | — |
 *   | fits a fixed rail | fixed at `layout.contextRail.minTablet` | none |
 *   | fits a draggable one | starts at `layout.contextRail.initial` | `ResizableSplit` |
 *
 * Where the width rules live
 *   `split-geometry.ts`'s `canSplit`, not here. A 600 dp tablet minus an 80 dp nav rail
 *   cannot hold a 280 dp rail beside a readable column, so "tablet" does not mean "rail" —
 *   it means "rail if it fits". That distinction is arithmetic, and it is tested rather
 *   than eyeballed at three fixed viewport sizes.
 *
 * Commit on release, not per frame
 *   The prototype learned this twice (`app_shell.dart:344-398`): committing the drag width
 *   to app state on every frame rebuilt its entire shell. `ResizableSplit` drives the width
 *   through a Reanimated shared value and calls `onWidthCommitted` once, on release. This
 *   component's `useState` therefore updates at most once per drag.
 */

import { useState, type JSX, type ReactNode } from 'react';
import { View } from 'react-native';

import { borderWidth, layout } from '@/theme';
import { createThemedStyles, useResponsiveLayout, useTheme } from '@/theme/runtime';

import { contextRailBounds, contextRailMode } from './context-rail-mode';
import { ResizableSplit } from './ResizableSplit';
import { resolvePaneWidth } from './split-geometry';

/** Inputs to {@link ContextRailShell}. */
export interface ContextRailShellProps {
  /** The main pane — the reading canvas. */
  readonly children: ReactNode;
  /** The rail's contents. Only rendered when there is room for the rail. */
  readonly rail: ReactNode;
  /** What a screen reader calls the divider. */
  readonly handleAccessibilityLabel?: string | undefined;
  /** Test hook on the rail. */
  readonly railTestID?: string | undefined;
}

/**
 * Lay a main pane out beside a context rail, in whichever of the three regimes fits.
 *
 * @param props - See {@link ContextRailShellProps}.
 * @returns The split, the fixed rail, or the main pane alone.
 *
 * Side effects: remembers the dragged width for the life of the component.
 */
export function ContextRailShell({
  children,
  rail,
  handleAccessibilityLabel = 'Resize the context rail',
  railTestID,
}: ContextRailShellProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const { width, formFactor } = useResponsiveLayout();
  const [committedWidth, setCommittedWidth] = useState<number | undefined>(undefined);

  const mode = contextRailMode({ width, formFactor });
  const bounds = contextRailBounds({ width, formFactor });
  const railBody = (
    <View style={styles.rail} testID={railTestID}>
      {rail}
    </View>
  );

  if (mode === 'resizable') {
    return (
      <ResizableSplit
        edge="trailing"
        resizable={railBody}
        flexible={children}
        initialWidth={resolvePaneWidth(committedWidth, layout.contextRail.initial, bounds)}
        minPane={bounds.minPane}
        minOther={bounds.minOther}
        handleWidth={bounds.handleWidth}
        onCommit={setCommittedWidth}
        accessibilityLabel={handleAccessibilityLabel}
      />
    );
  }

  if (mode === 'none') return <View style={styles.single}>{children}</View>;

  // The tablet regime: a rail, but a fixed one. There is room for the context beside the
  // scripture and not enough room to let the reader make either of them unreadable.
  return (
    <View style={styles.row}>
      <View style={styles.flexible}>{children}</View>
      <View style={styles.fixedRail}>{railBody}</View>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  single: { flex: 1 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  flexible: { flex: 1, minWidth: 0 },
  fixedRail: { width: layout.contextRail.minTablet },
  rail: {
    flex: 1,
    backgroundColor: theme.background.elevated,
    borderLeftWidth: borderWidth.hairline,
    borderLeftColor: theme.line.hairline,
    overflow: 'hidden',
  },
}));
