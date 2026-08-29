/**
 * What a map frame actually contains — the measurement the site map is framed by.
 *
 * Purpose
 *   A locator map is readable when land and water share the frame, and unreadable when one
 *   of them is a wedge in a corner. Every cheaper test misses that distinction, and two of
 *   them were shipped before this module existed:
 *
 *   - *"Is a coastline ring visible?"* answers yes for every inland site in the gazetteer,
 *     because the single ring carrying the whole of Asia overlaps the viewport wherever the
 *     camera sits. Lystra therefore had a visible coastline while showing none.
 *   - *"Are twelve of its vertices in frame?"* answers yes for the reported Lystra
 *     screenshot: twelve points of Lake Tuz in one corner and twelve of the Gulf of Antalya
 *     in the other. That is the picture the report described — two black wedges intruding
 *     from the edges of an otherwise empty grid — passing the test that was meant to
 *     prevent it. Spreading the vertices apart does not help either: two opposite corners
 *     span the whole diagonal, which is the highest score a spread can give.
 *
 * What is measured instead
 *   The **share of the frame that is water**, by sampling a grid of points across the
 *   visible degrees and asking each one whether it falls inside the land. That is the
 *   quantity a reader actually judges: a frame that is 2 % water reads as a broken render
 *   however that 2 % is arranged, and one that is a third water reads as a coast. Land and
 *   lakes are tested together under the same even-odd rule the basemap draws with, so a
 *   point inside Asia and inside Lake Tuz crosses two rings, counts as outside, and is
 *   correctly called water.
 *
 * Why degrees and not pixels
 *   Ring vertices are already `[lon, lat]`, so sampling in degrees skips the projection
 *   entirely: the crossing test is a subtraction and a multiply per edge, on rings whose
 *   bounding box overlaps the view at all. Mercator stretches latitude, so the grid is
 *   marginally denser at the top of the frame than the bottom; over the two-to-six degree
 *   spans a site map uses, that bias is far below the precision this figure is read at.
 *
 * Cost
 *   `SAMPLE_COLUMNS × SAMPLE_ROWS` crossing tests against the rings that survive the cull.
 *   The caller runs it a handful of times on a sheet open and on a resize, never per frame.
 *
 * Dependencies
 *   `./basemap` for the ring cull, `./projection` for the visible bounds. Pure — no React,
 *   no SVG, Node-testable.
 */

import { ringOverlapsView, type FlatRing } from './basemap';
import { visibleBounds, type GeoBounds, type MapTransform, type Viewport } from './projection';

/** What one frame holds. */
export interface FrameGeography {
  /** Share of the frame that is neither land nor an island, in `0..1`. */
  readonly waterFraction: number;
  /** Vendored coastline vertices inside the visible degrees. */
  readonly coastPoints: number;
}

/** The answer for a degenerate transform: no claim either way. */
const NO_GEOGRAPHY: FrameGeography = { waterFraction: 0, coastPoints: 0 };

/**
 * Grid resolution.
 *
 * 9 × 7 is 63 samples: fine enough that one lake cannot move the fraction by more than
 * 1.6 points, coarse enough to stay under a millisecond against the 3,327-point basemap.
 * Odd counts on both axes put a sample on the frame's centre line rather than straddling
 * it, so a coast running exactly through the middle is counted rather than missed.
 */
const SAMPLE_COLUMNS = 9;

/** Rows of the sample grid. See {@link SAMPLE_COLUMNS}. */
const SAMPLE_ROWS = 7;

/**
 * Measure what a frame contains.
 *
 * @param rings - `basemap.land` and `basemap.lakes` together. Both are needed: the even-odd
 *   rule is what subtracts a lake from the land it sits in, and passing land alone would
 *   report the Sea of Galilee as dry ground.
 * @param transform - Where the map currently sits.
 * @param viewport - The pixel box.
 * @returns The water share and the in-frame coastline vertex count. A degenerate transform
 *   yields zeroes rather than throwing. Side effects: none.
 *
 * @example
 * frameGeography(rings, transform, viewport); // { waterFraction: 0.41, coastPoints: 27 }
 */
export function frameGeography(
  rings: readonly FlatRing[],
  transform: MapTransform,
  viewport: Viewport,
): FrameGeography {
  const view = visibleBounds(transform, viewport);
  if (view === null) return NO_GEOGRAPHY;

  const inView = rings.filter((ring) => ringOverlapsView(ring, view));
  if (inView.length === 0) return { waterFraction: 1, coastPoints: 0 };

  return {
    waterFraction: sampleWater(inView, view),
    coastPoints: countVerticesInside(inView, view),
  };
}

/**
 * Share of a grid of sample points that falls outside the land.
 *
 * @param rings - The rings that overlap the view.
 * @param view - The visible degrees.
 * @returns The water share in `0..1`. Side effects: none.
 */
function sampleWater(rings: readonly FlatRing[], view: GeoBounds): number {
  const lonStep = (view.maxLon - view.minLon) / (SAMPLE_COLUMNS + 1);
  const latStep = (view.maxLat - view.minLat) / (SAMPLE_ROWS + 1);
  let water = 0;
  for (let column = 1; column <= SAMPLE_COLUMNS; column += 1) {
    for (let row = 1; row <= SAMPLE_ROWS; row += 1) {
      const longitude = view.minLon + lonStep * column;
      const latitude = view.minLat + latStep * row;
      if (!isLand(rings, longitude, latitude)) water += 1;
    }
  }
  return water / (SAMPLE_COLUMNS * SAMPLE_ROWS);
}

/**
 * Whether a point is on land, under the even-odd rule the basemap is drawn with.
 *
 * The last edge wraps to the first vertex rather than stopping at the last: three of the
 * 127 vendored rings do not repeat their opening point, and a ray test that skipped their
 * closing edge would report the wrong side for every sample beyond it.
 *
 * @param rings - The rings that overlap the view.
 * @param longitude - Sample longitude.
 * @param latitude - Sample latitude.
 * @returns True when an eastward ray from the point crosses an odd number of edges.
 *   Side effects: none.
 */
function isLand(rings: readonly FlatRing[], longitude: number, latitude: number): boolean {
  let inside = false;
  for (const ring of rings) {
    const vertices = Math.floor(ring.length / 2);
    for (let index = 0, previous = vertices - 1; index < vertices; previous = index, index += 1) {
      const aLon = ring[2 * index]!;
      const aLat = ring[2 * index + 1]!;
      const bLon = ring[2 * previous]!;
      const bLat = ring[2 * previous + 1]!;
      if (aLat > latitude === bLat > latitude) continue;
      const crossing = aLon + ((latitude - aLat) / (bLat - aLat)) * (bLon - aLon);
      if (longitude < crossing) inside = !inside;
    }
  }
  return inside;
}

/**
 * How many ring vertices fall inside the visible degrees.
 *
 * Kept alongside the water share because they answer different halves of one question: the
 * share says whether both elements are present, the count says whether the boundary between
 * them is drawn at any detail worth looking at.
 *
 * @param rings - The rings that overlap the view.
 * @param view - The visible degrees.
 * @returns The count. Side effects: none.
 */
function countVerticesInside(rings: readonly FlatRing[], view: GeoBounds): number {
  let found = 0;
  for (const ring of rings) {
    for (let index = 0; index + 1 < ring.length; index += 2) {
      const longitude = ring[index]!;
      const latitude = ring[index + 1]!;
      if (
        longitude >= view.minLon &&
        longitude <= view.maxLon &&
        latitude >= view.minLat &&
        latitude <= view.maxLat
      ) {
        found += 1;
      }
    }
  }
  return found;
}
