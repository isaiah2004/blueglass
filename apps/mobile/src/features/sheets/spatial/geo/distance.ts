/**
 * Great-circle distance, and the honest captions that go with it.
 *
 * Purpose
 *   `image1.png` prints a stat strip reading "125 Miles / by Sea" and "2 Days / Estimated
 *   Travel". The badge API supplies neither figure: `RoutePayloadOut` carries waypoints, a
 *   camera, a passage and a scheme, and nothing about how far or how long.
 *
 * What this module refuses to do
 *   Duration, and the length of a path. Duration depends on season, rig and wind, none of
 *   which any dataset in `data/raw/` records. A *path* length is the subtler refusal: it
 *   was derived here and captioned `STRAIGHT LINE`, which sounded careful but was measuring
 *   a route nobody travelled — the chapter-scheme waypoints are the places the text NAMES,
 *   in the order it names them, so summing the gaps between them produced a figure with no
 *   referent at all (`builders/spatial.py`, and the Route badge's own header).
 *
 * What is left, and why it is sound
 *   `spanMiles` — how far apart the two furthest-apart places are. That is a fact about a
 *   set of pins rather than about a journey: it stays true however the pins are ordered,
 *   and it answers the question the map actually raises, which is how much of the world
 *   this chapter reaches across.
 *
 * Dependencies
 *   `./projection` for the coordinate type. Standard library maths otherwise.
 */

import type { GeoPoint } from './projection';

/**
 * Mean earth radius in statute miles (IUGG mean radius 6,371.0088 km / 1.609344).
 *
 * A sphere, not the WGS 84 ellipsoid: over the ~1,000 miles these routes span, the
 * spherical approximation errs by about 0.3 %, which is far inside the rounding the stat
 * strip applies and far outside anything the reader could act on.
 */
const EARTH_RADIUS_MILES = 3958.7613;

/** Degrees to radians, so the conversion is never written inline. */
const RADIANS_PER_DEGREE = Math.PI / 180;

/** Below this, a leg is two names for the same place and is not worth a figure. */
const NEGLIGIBLE_MILES = 0.5;

/**
 * Great-circle distance between two coordinates.
 *
 * Uses the haversine form rather than the spherical law of cosines: the latter loses
 * precision for short legs, and the Acts 16 route has legs of a few miles between adjacent
 * Aegean stops.
 *
 * @param from - `[longitude, latitude]` in degrees.
 * @param to - `[longitude, latitude]` in degrees.
 * @returns Distance in statute miles, always non-negative. Side effects: none.
 */
export function greatCircleMiles(from: GeoPoint, to: GeoPoint): number {
  const fromLatitude = from[1] * RADIANS_PER_DEGREE;
  const toLatitude = to[1] * RADIANS_PER_DEGREE;
  const deltaLatitude = toLatitude - fromLatitude;
  const deltaLongitude = (to[0] - from[0]) * RADIANS_PER_DEGREE;

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

/**
 * How far apart the two furthest-apart places in a set are.
 *
 * Order-independent by construction, which is the property that makes it safe to print
 * beside a mention-order map: shuffling the pins cannot change the answer, so the figure
 * cannot be read as a distance anybody covered.
 *
 * @param points - The pins, in any order.
 * @returns The greatest great-circle distance between any two of them, in miles; 0 for
 *   fewer than two points. Side effects: none.
 */
export function spanMiles(points: readonly GeoPoint[]): number {
  let widest = 0;
  for (let index = 0; index < points.length; index += 1) {
    for (let other = index + 1; other < points.length; other += 1) {
      const gap = greatCircleMiles(points[index]!, points[other]!);
      if (gap > widest) widest = gap;
    }
  }
  return widest;
}

/**
 * The space between a figure and its unit.
 *
 * A NO-BREAK SPACE (U+00A0), not an ordinary one. In a 232 dp context rail the stat cell
 * is narrow enough that the browser wrapped `3,575 mi` into `3,575` above `mi`, which
 * reads as two facts instead of one. A figure and its unit are one token.
 */
const UNIT_SPACE = '\u00a0';

/**
 * Format a distance for the stat strip.
 *
 * @param miles - A distance from {@link spanMiles} or {@link greatCircleMiles}.
 * @returns A grouped whole number of miles, e.g. `1,214 mi`, or `null` when the figure is
 *   too small to mean anything — in which case the caller shows no stat rather than
 *   showing `0 mi`. Side effects: none.
 */
export function formatMiles(miles: number): string | null {
  if (!Number.isFinite(miles) || miles < NEGLIGIBLE_MILES) return null;
  const rounded = Math.round(miles);
  return `${rounded.toLocaleString('en-US')}${UNIT_SPACE}mi`;
}

/**
 * Format a whole count for the stat strip.
 *
 * @param count - How many places the passage names.
 * @returns The count as a string. Side effects: none.
 */
export function formatCount(count: number): string {
  return String(Math.max(0, Math.trunc(count)));
}
