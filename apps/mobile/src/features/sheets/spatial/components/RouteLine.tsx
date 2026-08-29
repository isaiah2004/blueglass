/**
 * The line between the pins — a drawn route, or a quiet mention-order trace.
 *
 * Purpose
 *   `design-language.md` §6: "Route lines on maps: draw progressively, gold or cyan, with a
 *   soft glow." That is the `route` variant — a wide translucent stroke for the glow, a
 *   crisp stroke over it, and a dash offset animating from hidden to drawn.
 *
 * Why there is a second variant
 *   §6 was written for a line that is a route. Under `routes.scheme = 'chapter'` the pins
 *   are the places the text NAMES, in the order it names them, and a glowing cyan polyline
 *   animating itself through sixteen of them reads as a voyage however carefully the
 *   caption above it is worded — Acts 16's pins include Jerusalem, which the chapter names
 *   without anyone going there. The `mentionOrder` variant is therefore a dashed hairline
 *   at under half strength, with no glow and no draw: a connector that shows the sequence
 *   and does not narrate it. `builders/spatial.py` and the sheet's README have the rest.
 *
 * Why this component holds the animation state and nothing else does
 *   `DECISIONS.md` A-3: the prototype re-renders its whole shell per animation notify, and
 *   "Flutter absorbs it; React would not". `useDrawProgress` lives here, in the smallest
 *   subtree that can hold it, so sixty frames a second re-render two `<Path>` elements and
 *   never the 3,327-point coastline beside them.
 *
 * Reduced motion
 *   With `prefers-reduced-motion` the duration is zero, progress starts at 1, and no frame
 *   is ever scheduled. The line simply appears with the sheet's own cross-fade, which is
 *   what §6 asks for.
 *
 * Dependencies
 *   `react-native-svg`, the route-path geometry, the draw hook, the derived palette.
 */

import { useMemo, type JSX } from 'react';
import { Path } from 'react-native-svg';

import { useTheme } from '@/theme/runtime';

import { dashFor, routeLength, routeSegments, segmentsToPath } from '../geo/route-path';
import type { ScreenPoint } from '../geo/projection';
import { useDrawProgress } from '../hooks/use-draw-progress';
import { mapPalette } from '../theme/map-palette';

/** Inputs to {@link RouteLine}. */
export interface RouteLineProps {
  /** The waypoints, already projected into the map's pixel space. */
  readonly points: readonly ScreenPoint[];
  /** How long the draw takes. `0` means "already drawn" — the reduced-motion path. */
  readonly durationMs: number;
  /** Changing this restarts the draw. Pass the map's title. */
  readonly restartKey: string;
  /**
   * `route` draws §6's glowing progressive line. `mentionOrder` draws the quiet dashed
   * connector, and ignores `durationMs` — a trace does not animate itself into being.
   */
  readonly variant: RouteLineVariant;
}

/** What the line between the pins is allowed to say. */
export type RouteLineVariant = 'route' | 'mentionOrder';

/** Stroke width of the line itself, in density-independent pixels. */
const LINE_WIDTH = 2.5;

/** Stroke width of the glow beneath it. Four times the line, per the mockup's soft halo. */
const GLOW_WIDTH = LINE_WIDTH * 4;

/** Stroke width of a mention-order trace: a hairline, not a road. */
const TRACE_WIDTH = 1;

/** The trace's dash pattern, in density-independent pixels: a short dash, an equal gap. */
const TRACE_DASH = '3 5';

/**
 * Draw the route.
 *
 * @param props - See {@link RouteLineProps}.
 * @returns One dashed path for a trace, two — glow, then line — for a route, or nothing
 *   when there are too few pins to join.
 *
 * Side effects: schedules animation frames while the draw is in progress.
 */
export function RouteLine({
  points,
  durationMs,
  restartKey,
  variant,
}: RouteLineProps): JSX.Element | null {
  const palette = mapPalette(useTheme());
  const isTrace = variant === 'mentionOrder';
  const progress = useDrawProgress(isTrace ? 0 : durationMs, restartKey);

  const geometry = useMemo(() => {
    const segments = routeSegments(points);
    return { path: segmentsToPath(segments), length: routeLength(segments) };
  }, [points]);

  if (geometry.path === '') return null;

  if (isTrace) return <MentionTrace path={geometry.path} stroke={palette.trace} />;

  const dash = dashFor(geometry.length, progress);

  return (
    <>
      <Path
        d={geometry.path}
        fill="none"
        stroke={palette.routeGlow}
        strokeWidth={GLOW_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash.strokeDasharray}
        strokeDashoffset={dash.strokeDashoffset}
        testID="spatial-route-glow"
      />
      <Path
        d={geometry.path}
        fill="none"
        stroke={palette.route}
        strokeWidth={LINE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash.strokeDasharray}
        strokeDashoffset={dash.strokeDashoffset}
        testID="spatial-route-line"
      />
    </>
  );
}

/**
 * The quiet connector between pins that are only in mention order.
 *
 * @param props.path - The polyline, already projected.
 * @param props.stroke - `mapPalette.trace`.
 * @returns One dashed hairline. Side effects: none — nothing here animates.
 */
function MentionTrace({
  path,
  stroke,
}: {
  readonly path: string;
  readonly stroke: string;
}): JSX.Element {
  return (
    <Path
      d={path}
      fill="none"
      stroke={stroke}
      strokeWidth={TRACE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={TRACE_DASH}
      testID="spatial-mention-trace"
    />
  );
}
