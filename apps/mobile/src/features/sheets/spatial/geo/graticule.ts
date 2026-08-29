/**
 * The latitude and longitude grid drawn under the map.
 *
 * Purpose
 *   Two problems, one answer. The first is honesty: the 3D City sheet claims a place is at
 *   a stated coordinate, and a graticule is the thing that lets a reader *see* the claim
 *   rather than read it in a caption. The second is that a site inland of any coast —
 *   Lystra, Iconium, Derbe — projects onto a rectangle with no coastline in it at all, and
 *   an empty gradient reads as a failed render rather than as open country.
 *
 * Why this rather than inventing terrain
 *   `Q-008` and pillar 3. Hill shading, roads, rivers and city blocks would all fill the
 *   space, and every one of them would be geography we do not hold and cannot source. A
 *   coordinate grid asserts nothing beyond the projection itself.
 *
 * The rounding
 *   Lines fall on round degrees, chosen from a fixed ladder so the labels read `33 E` and
 *   never `32.847 E`. The step is the smallest one that keeps the grid under a line budget,
 *   so it densifies as the reader zooms in without ever becoming a hatch.
 *
 * Dependencies
 *   `./projection`. No React, no SVG.
 */

import {
  mercatorX,
  mercatorY,
  visibleBounds,
  type MapTransform,
  type Viewport,
} from './projection';

/** One drawn grid line. */
export interface GraticuleLine {
  /** Pixel position: `x` for a meridian, `y` for a parallel. */
  readonly position: number;
  /** What it is, e.g. `33 E` or `38 N`. */
  readonly label: string;
}

/** The whole grid. */
export interface Graticule {
  /** Lines of constant longitude, left to right. */
  readonly meridians: readonly GraticuleLine[];
  /** Lines of constant latitude, top to bottom. */
  readonly parallels: readonly GraticuleLine[];
  /** The spacing chosen, in degrees. Exposed so a test can assert the ladder. */
  readonly stepDegrees: number;
}

/** The spacings a graticule is allowed to use, in degrees. */
const NICE_STEPS: readonly number[] = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30];

/** More lines than this in either axis and the grid reads as a hatch. */
const MAX_LINES = 7;

/** Format a degree value without a trailing `.0`, and with its hemisphere. */
function labelFor(value: number, positive: string, negative: string): string {
  const magnitude = Math.abs(value);
  const text = Number.isInteger(magnitude) ? magnitude.toFixed(0) : magnitude.toFixed(2);
  return `${text} ${value < 0 ? negative : positive}`;
}

/** Every multiple of `step` between `from` and `to`, inclusive. */
function multiplesBetween(from: number, to: number, step: number): number[] {
  const first = Math.ceil(from / step) * step;
  const values: number[] = [];
  for (let value = first; value <= to; value += step) {
    // Re-round each value: repeated addition of 0.1 drifts, and a label reading
    // `32.900000000000006 E` would be the arithmetic showing through the design.
    values.push(Number((Math.round(value / step) * step).toFixed(6)));
  }
  return values;
}

/**
 * Build the grid for what is currently on screen.
 *
 * @param transform - The map's current transform.
 * @param viewport - The pixel box.
 * @returns The meridians and parallels to draw, and the spacing chosen. An empty grid for a
 *   degenerate transform, which draws nothing rather than throwing. Side effects: none.
 */
export function graticule(transform: MapTransform, viewport: Viewport): Graticule {
  const empty: Graticule = { meridians: [], parallels: [], stepDegrees: 0 };
  if (!Number.isFinite(transform.scale) || transform.scale <= 0) return empty;

  const range = visibleBounds(transform, viewport);
  if (range === null) return empty;
  const span = Math.max(range.maxLon - range.minLon, range.maxLat - range.minLat);
  if (!Number.isFinite(span) || span <= 0) return empty;

  const step = NICE_STEPS.find((candidate) => span / candidate <= MAX_LINES);
  if (step === undefined) return empty;

  return {
    stepDegrees: step,
    meridians: multiplesBetween(range.minLon, range.maxLon, step).map((longitude) => ({
      position: mercatorX(longitude) * transform.scale + transform.offsetX,
      label: labelFor(longitude, 'E', 'W'),
    })),
    parallels: multiplesBetween(range.minLat, range.maxLat, step).map((latitude) => ({
      position: mercatorY(latitude) * transform.scale + transform.offsetY,
      label: labelFor(latitude, 'N', 'S'),
    })),
  };
}
