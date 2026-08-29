/**
 * The map's scale bar.
 *
 * Purpose
 *   A drawn map with no scale is a picture. The 3D City sheet is a *site* sheet — its whole
 *   claim is "this place is here, to this precision" — and a reader cannot judge that
 *   without knowing how far across the picture is. A scale bar is also the cheapest honest
 *   substitute for the depth cue a 3D reconstruction would have given, which `Q-008` says
 *   we cannot have.
 *
 * The arithmetic
 *   In Web Mercator, ground resolution shrinks with the cosine of the latitude:
 *   `metres per pixel = 40,075,016.686 * cos(latitude) / worldWidthInPixels`. The world
 *   width is `MapTransform.scale`, which is exactly why the transform keeps its scale in
 *   Mapbox's terms rather than as an abstract multiplier.
 *
 * The rounding
 *   A scale bar reads `50 mi`, never `47 mi`. The bar's *length* is chosen to fit a round
 *   distance rather than the distance being chosen to fit a fixed bar.
 *
 * Dependencies
 *   `./projection`. No React.
 */

import { clampLatitude, type MapTransform } from './projection';

/** A scale bar: how long to draw it, and what to print under it. */
export interface ScaleBar {
  /** Bar length in pixels. Never exceeds the maximum the caller allows. */
  readonly widthPx: number;
  /** What the bar means, e.g. `50 mi`. */
  readonly label: string;
}

/** Equatorial circumference in metres, WGS 84. */
const EQUATORIAL_CIRCUMFERENCE_M = 40_075_016.686;

/** Metres in a statute mile. */
const METRES_PER_MILE = 1609.344;

/** The distances a scale bar is allowed to show, in miles. */
const NICE_MILES: readonly number[] = [
  0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000,
];

/**
 * The shortest bar worth drawing, in pixels.
 *
 * Below this the bar is a tick rather than a ruler and cannot be read against the map, so
 * the sheet draws nothing instead. Measured against `size.icon.md` (20 dp): a bar the
 * reader cannot compare to anything is worse than an absent one.
 */
const MIN_BAR_WIDTH_PX = 24;

/** Degrees per radian. */
const DEGREES_PER_RADIAN = 180 / Math.PI;

/**
 * Ground resolution at a given latitude.
 *
 * @param transform - The map's current transform.
 * @param latitude - Where on the map the bar is drawn. Resolution varies with latitude, so
 *   a bar drawn at the bottom of a tall map is not the same scale as one at the top; the
 *   caller passes the latitude of the bar itself.
 * @returns Metres per pixel, or `Infinity` for a degenerate transform. Side effects: none.
 */
export function metresPerPixel(transform: MapTransform, latitude: number): number {
  if (!Number.isFinite(transform.scale) || transform.scale <= 0) return Number.POSITIVE_INFINITY;
  const radians = clampLatitude(latitude) / DEGREES_PER_RADIAN;
  return (EQUATORIAL_CIRCUMFERENCE_M * Math.cos(radians)) / transform.scale;
}

/**
 * Choose a scale bar that fits.
 *
 * @param transform - The map's current transform.
 * @param latitude - The latitude the bar is drawn at.
 * @param maxWidthPx - The longest bar the layout allows.
 * @returns The largest round distance whose bar fits, or `null` when no round distance
 *   produces a bar between {@link MIN_BAR_WIDTH_PX} and `maxWidthPx` — in which case the
 *   caller draws no bar rather than an unreadable one. Side effects: none.
 */
export function scaleBar(
  transform: MapTransform,
  latitude: number,
  maxWidthPx: number,
): ScaleBar | null {
  const resolution = metresPerPixel(transform, latitude);
  if (!Number.isFinite(resolution) || resolution <= 0 || maxWidthPx <= 0) return null;

  let chosen: ScaleBar | null = null;
  for (const miles of NICE_MILES) {
    const widthPx = (miles * METRES_PER_MILE) / resolution;
    if (widthPx > maxWidthPx) break;
    if (widthPx < MIN_BAR_WIDTH_PX) continue;
    chosen = { widthPx, label: `${formatNiceMiles(miles)} mi` };
  }
  return chosen;
}

/** Print a round distance without a trailing `.0`. */
function formatNiceMiles(miles: number): string {
  return miles < 1 ? miles.toString() : Math.round(miles).toLocaleString('en-US');
}
