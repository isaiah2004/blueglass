/**
 * How wide a map opens — measured against the basemap, not guessed.
 *
 * Purpose
 *   A map with nothing on it is not a map. Jerusalem catches the Mediterranean at the
 *   chosen zoom and looks like a place; Lystra, 120 miles inland, opened on a frame that
 *   was 3 % water — a near-empty grid with a corner of Lake Tuz and a corner of the Gulf of
 *   Antalya intruding from the edges. The report called it a rendering bug, which is the
 *   correct reading of that picture.
 *
 * Both maps need this, not only the site map
 *   The `[Route]` map fits its camera to the pins, and a chapter whose places are all in
 *   one town fits it to nothing: Mark 11 names Jerusalem, Bethphage, Bethany and the Mount
 *   of Olives, which span **0.022 degrees**, and the fitted frame is a flat field with four
 *   dots on it and no coastline, no lake and no scale a reader can attach a meaning to.
 *   {@link framedTransform} widens that fit about its own centre until there is something
 *   around the pins — and never narrows it, so every pin the fit included stays included.
 *
 * Why a fixed zoom could not have solved this
 *   Zoom is degrees per *pixel*, so the same constant frames a different amount of world in
 *   a 375 dp phone sheet, a 290 dp rail and a 560 dp wide rail. `CitySiteMap`'s zoom was
 *   chosen by looking at one width, which is exactly why it failed at another. A constant
 *   low enough for the emptiest inland site would also throw Jerusalem's coastline into a
 *   continental view where the pin means nothing.
 *
 * Why counting coastline vertices could not solve it either
 *   That was the previous rule, and the reported screenshot is what passed it: twelve
 *   points of a lake in one corner and twelve of a gulf in the other are twelve points.
 *   Spreading them apart scores no better — two opposite corners span the whole diagonal.
 *   `./frame-geography` measures the quantity a reader actually judges instead: the share
 *   of the frame that is water.
 *
 * The rule
 *   Start at the preferred zoom and step out until the frame holds a readable share of BOTH
 *   land and water, stopping at a floor. Coastal sites keep the framing they already had —
 *   the loop exits on its first iteration — and an inland site widens only as far as it must
 *   to have recognisable geography in it. Nothing is invented: the widening is decided by
 *   the same public-domain geometry the map then draws.
 *
 * When the floor is reached
 *   Babylon, Nineveh and Susa are measurably landlocked: no zoom down to the floor puts
 *   enough water in frame. That is not a failure to be hidden, so the result says so, and
 *   `CitySiteMap` answers it by labelling every grid line rather than the usual two — with
 *   no coast to read position from, the graticule is the only geography there is.
 *
 * Cost
 *   One `frameGeography` pass per step, measured at 0.21 ms against the whole basemap, and
 *   the first step succeeds for every coastal site. The caller memoises on the coordinates
 *   and the measured viewport, so this runs on a sheet open and on a resize, not per frame.
 *
 * Dependencies
 *   `./basemap`, `./frame-geography` and `./projection`. Pure — no React, no SVG,
 *   Node-testable.
 */

import { basemap } from './basemap';
import { frameGeography } from './frame-geography';
import {
  centreOf,
  transformForZoom,
  zoomOf,
  type GeoPoint,
  type MapTransform,
  type Viewport,
} from './projection';

/** The framing a map opens with. */
export interface MapFraming {
  /** Degrees per pixel the camera is set to. */
  readonly zoom: number;
  /** True when the accepted frame holds a readable share of both land and water. */
  readonly framed: boolean;
  /** True when no vendored coastline is drawn in the accepted frame at all. */
  readonly coastless: boolean;
}

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
 * stops locating a site and starts locating an empire. Most inland sites find water long
 * before this; the floor is what stops Babylon, whose frame is still 13 % water here,
 * widening until its pin means nothing.
 */
export const MIN_MAP_ZOOM = 3;

/**
 * How much of the frame must be water before it reads as a coast.
 *
 * Measured across the gazetteer's extremes at all four container widths the sheets are
 * handed. Jerusalem sits at 0.25–0.30 and Samothrace at 0.43–0.59 at the preferred zoom, so
 * both keep the close framing they already had. Lystra is 0.00–0.11 there — the reported
 * screenshot — and first clears this bar between one and one and a half zoom levels out,
 * which is the widening that puts the Anatolian coast and the lakes in frame together.
 * Below about 0.15 a frame reads as flat ground however the water is arranged.
 *
 * The same figure bounds the other end: a frame more than `1 - MIN_WATER_FRACTION` water is
 * open sea, which is as unreadable as open ground and is what a site outside the basemap's
 * crop would otherwise score.
 */
const MIN_WATER_FRACTION = 0.18;

/** Land and lakes together — the even-odd pair the basemap is drawn with. */
const COASTLINE_RINGS = [...basemap.land, ...basemap.lakes];

/**
 * Choose the framing for a map centred on one coordinate.
 *
 * @param coordinates - `[longitude, latitude]` the frame is centred on.
 * @param viewport - The measured pixel box the map draws into.
 * @param preferredZoom - The framing to use when it already reads as a place.
 * @returns The zoom to open at, whether that frame is balanced, and whether any coastline
 *   is drawn in it at all. Never below {@link MIN_MAP_ZOOM}. Side effects: none.
 *
 * @example
 * mapFraming([35.23, 31.78], viewport, 6.2); // { zoom: 6.2, framed: true, coastless: false }
 */
export function mapFraming(
  coordinates: GeoPoint,
  viewport: Viewport,
  preferredZoom: number,
): MapFraming {
  for (let zoom = preferredZoom; zoom > MIN_MAP_ZOOM; zoom -= ZOOM_STEP) {
    if (isBalanced(coordinates, viewport, zoom)) {
      return { zoom, framed: true, coastless: false };
    }
  }

  const floor = frameGeography(
    COASTLINE_RINGS,
    transformForZoom(coordinates, MIN_MAP_ZOOM, viewport),
    viewport,
  );
  return { zoom: MIN_MAP_ZOOM, framed: false, coastless: floor.coastPoints === 0 };
}

/**
 * Whether one candidate frame holds a readable share of both land and water.
 *
 * @param coordinates - `[longitude, latitude]` of the site.
 * @param viewport - The measured pixel box.
 * @param zoom - The candidate zoom.
 * @returns True inside `[MIN_WATER_FRACTION, 1 - MIN_WATER_FRACTION]`. Side effects: none.
 */
function isBalanced(coordinates: GeoPoint, viewport: Viewport, zoom: number): boolean {
  const { waterFraction } = frameGeography(
    COASTLINE_RINGS,
    transformForZoom(coordinates, zoom, viewport),
    viewport,
  );
  return waterFraction >= MIN_WATER_FRACTION && waterFraction <= 1 - MIN_WATER_FRACTION;
}

/**
 * Widen a fitted camera until its frame holds something to look at.
 *
 * The route map's camera comes from the pins' own bounding box, which is right for Acts 16
 * and wrong for Mark 11, where every place named is inside one town. This applies the same
 * rule the site map uses, about the fit's own centre so the pins stay where they were.
 *
 * It can only widen. A fit already wider than the floor — Acts 21 spans nine degrees — is
 * returned untouched, because narrowing a fitted camera would push pins off the map.
 *
 * @param fitted - The camera fitted to the pins.
 * @param viewport - The measured pixel box.
 * @returns `fitted`, or the same view widened about its centre. Side effects: none.
 */
export function framedTransform(fitted: MapTransform, viewport: Viewport): MapTransform {
  const centre = centreOf(fitted, viewport);
  if (centre === null) return fitted;

  const fittedZoom = zoomOf(fitted);
  const { zoom } = mapFraming(centre, viewport, fittedZoom);
  if (zoom >= fittedZoom) return fitted;

  const factor = Math.pow(2, zoom - fittedZoom);
  return {
    scale: fitted.scale * factor,
    offsetX: viewport.width / 2 - (viewport.width / 2 - fitted.offsetX) * factor,
    offsetY: viewport.height / 2 - (viewport.height / 2 - fitted.offsetY) * factor,
  };
}
