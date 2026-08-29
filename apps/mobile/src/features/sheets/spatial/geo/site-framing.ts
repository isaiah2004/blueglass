/**
 * How wide the `[Site]` map opens — measured against the basemap, not guessed.
 *
 * Purpose
 *   A locator map with nothing on it is not a map. Jerusalem catches the Mediterranean at
 *   the chosen zoom and looks like a place; Lystra, 120 miles inland, rendered as an empty
 *   graticule with one pin and no coastline in frame — a grey blob that reads as a failed
 *   render rather than as a site in the middle of Anatolia.
 *
 * Why a fixed zoom could not have solved this
 *   Zoom is degrees per *pixel*, so the same constant frames a different amount of world in
 *   a 375 dp phone sheet, a 290 dp rail and a 560 dp wide rail. `CitySiteMap`'s zoom was
 *   chosen by looking at one width, which is exactly why it failed at another. A constant
 *   low enough for the emptiest inland site would also throw Jerusalem's coastline into a
 *   continental view where the pin means nothing.
 *
 * The rule
 *   Start at the preferred zoom and step out until enough of the vendored coastline is
 *   drawn inside the frame, stopping at a floor. Coastal sites keep the framing they
 *   already had — the loop exits on its first iteration — and an inland site widens only as
 *   far as it must to have a readable coast in it. Nothing is invented: the widening is
 *   decided by the same public-domain geometry the map then draws.
 *
 * Cost
 *   One `hasCoastlineInFrame` pass per step, and the first step succeeds for every coastal
 *   site. Each pass rejects most rings on four float comparisons against their cached
 *   bounding box, and returns on the FIRST vertex that lands in the viewport rather than
 *   projecting a whole ring. The caller memoises on the coordinates and the measured
 *   viewport, so this runs on a sheet open and on a resize, not per frame.
 *
 * Dependencies
 *   `./basemap` and `./projection`. Pure — no React, no SVG, Node-testable.
 */

import { basemap, hasCoastlineInFrame } from './basemap';
import { transformForZoom, type GeoPoint, type Viewport } from './projection';

/**
 * How far out one step goes.
 *
 * A whole zoom level doubles the span, which overshoots badly; a third of a level is a
 * visible widening without jumping a site from its region to its continent.
 */
const ZOOM_STEP = 1 / 3;

/**
 * The widest the site map may open.
 *
 * At 3 the frame is most of the eastern Mediterranean, which is the point at which a pin
 * stops locating a site and starts locating an empire. Every inland site in the gazetteer
 * finds land long before this; the floor exists so the loop terminates, not because it is
 * expected to be reached.
 */
export const MIN_SITE_ZOOM = 3;

/**
 * How much coastline counts as something to look at.
 *
 * Measured, not chosen: at Lystra's first step out exactly ONE vertex of a lake fell inside
 * the frame, which draws a mark a reader would take for a rendering fault rather than for
 * geography. Twelve vertices of a 0.05-degree simplified coastline is a line crossing the
 * view, not a corner grazing it — and it is low enough that Jerusalem (18 at the preferred
 * zoom in the narrowest rail) and Thyatira (12) keep the close framing they already had.
 */
const MIN_COASTLINE_POINTS = 12;

/**
 * The zoom at which a site's map has some coastline in it.
 *
 * @param coordinates - `[longitude, latitude]` of the site.
 * @param viewport - The measured pixel box the map draws into.
 * @param preferredZoom - The framing to use when it already contains land.
 * @returns `preferredZoom`, or the first step out from it that draws a readable length of
 *   coastline inside the frame, never below {@link MIN_SITE_ZOOM}. Side effects: none.
 *
 * @example
 * siteZoom([35.23, 31.78], viewport, 6.2); // 6.2 — Jerusalem already sees the sea
 */
export function siteZoom(coordinates: GeoPoint, viewport: Viewport, preferredZoom: number): number {
  for (let zoom = preferredZoom; zoom > MIN_SITE_ZOOM; zoom -= ZOOM_STEP) {
    const transform = transformForZoom(coordinates, zoom, viewport);
    if (
      hasCoastlineInFrame(
        [...basemap.land, ...basemap.lakes],
        transform,
        viewport,
        MIN_COASTLINE_POINTS,
      )
    ) {
      return zoom;
    }
  }

  return MIN_SITE_ZOOM;
}
