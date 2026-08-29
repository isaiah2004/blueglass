/**
 * The line between the pins, drawn only where an ordered journey is attested.
 *
 * Purpose
 *   `design-language.md` §6: "Route lines on maps: draw progressively, gold or cyan, with a
 *   soft glow." That is this component — a wide translucent stroke for the glow, a
 *   crisp stroke over it, and a dash offset animating from hidden to drawn.
 *
 * When it is drawn at all, which is the point
 *   §6 was written for a line that is a route, and a line between two pins asserts that
 *   somebody went from one to the other. Under `routes.scheme = 'chapter'` the pins are
 *   only the places the text NAMES, in the order it names them: Acts 16 names Jerusalem,
 *   where Paul does not go (16:4); Bithynia, which the Spirit "would not permit" them to
 *   enter (16:7); and Thyatira, which is Lydia's home town (16:14). Joining those is a
 *   pillar-3 false claim drawn in cyan.
 *
 *   A dashed hairline was tried as a way to say it more quietly. It is still a line: it
 *   still ran from Derbe across the Mediterranean to Jerusalem in the desktop rail, and a
 *   reader who sees a line between two pins reads a journey however thin it is. So under a
 *   scheme that cannot establish travel `RouteMap` renders no line at all and labels its
 *   pins with `MapKey`, and this component is only ever mounted for a scheme that can.
 *   `builders/spatial.py` and the sheet's README have the rest.
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
}

/** Stroke width of the line itself, in density-independent pixels. */
const LINE_WIDTH = 2.5;

/** Stroke width of the glow beneath it. Four times the line, per the mockup's soft halo. */
const GLOW_WIDTH = LINE_WIDTH * 4;

/**
 * Draw the route.
 *
 * @param props - See {@link RouteLineProps}.
 * @returns Two paths — the glow, then the line — or nothing when there are too few pins to
 *   join.
 *
 * Side effects: schedules animation frames while the draw is in progress.
 */
export function RouteLine({ points, durationMs, restartKey }: RouteLineProps): JSX.Element | null {
  const palette = mapPalette(useTheme());
  const progress = useDrawProgress(durationMs, restartKey);

  const geometry = useMemo(() => {
    const segments = routeSegments(points);
    return { path: segmentsToPath(segments), length: routeLength(segments) };
  }, [points]);

  if (geometry.path === '') return null;

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
