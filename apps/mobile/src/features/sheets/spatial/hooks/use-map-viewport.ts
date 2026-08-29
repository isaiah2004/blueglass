/**
 * Measuring the box a map has to draw into.
 *
 * Purpose
 *   An SVG needs pixel dimensions, and the sheet's width is not known until layout: a phone
 *   sheet, a 320 dp tablet rail and a resizable desktop rail all hand the same map a
 *   different width, and `Q-006` puts all three in scope. This hook is the one place that
 *   turns a laid-out width into the {@link Viewport} the projection consumes.
 *
 * Why `onLayout` and not `Dimensions`
 *   `Dimensions.get('window')` is the window, not the rail. On desktop the context rail is
 *   draggable (`components/split/ResizableSplit`), so a map sized from the window would be
 *   wrong the moment the reader moved the divider, and wrong again on every resize.
 *
 * Dependencies
 *   React and React Native's layout event. No SVG.
 */

import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import type { Viewport } from '../geo/projection';

/** What {@link useMapViewport} hands back. */
export interface MeasuredViewport {
  /** The measured box, or `null` before the first layout pass. */
  readonly viewport: Viewport | null;
  /** Attach to the container `View`. */
  readonly onLayout: (event: LayoutChangeEvent) => void;
}

/**
 * Measure a map's box.
 *
 * @param aspectRatio - Width divided by height. The container is given this ratio, so the
 *   caller sets the map's shape in one place and the height follows the width.
 * @returns The viewport and the layout handler. `viewport` is `null` for exactly one
 *   render; callers show their skeleton then rather than guessing a width.
 *
 * Side effects: holds one piece of state, updated only when the measured width changes by
 * a whole pixel — a sub-pixel layout jitter must not re-project 3,327 coastline points.
 */
export function useMapViewport(aspectRatio: number): MeasuredViewport {
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent): void => {
    const measured = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === measured ? current : measured));
  }, []);

  const viewport = useMemo(
    () => (width > 0 ? { width, height: Math.round(width / aspectRatio) } : null),
    [width, aspectRatio],
  );

  return { viewport, onLayout };
}
