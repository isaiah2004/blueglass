/**
 * Tests for the site map's framing rule.
 *
 * The defect these pin
 *   Lystra rendered as a near-empty grid with one or two large black wedges intruding from
 *   the edges — coastline fragments with no context, which reads as a rendering bug rather
 *   than as a map. The fix must widen an inland site until land and water share the frame,
 *   and must NOT widen a coastal one, because a Jerusalem framed like an empire is a
 *   different bug.
 *
 * Why the assertions are about what is in frame, not about the number 6.2
 *   The framing is a measurement against the vendored coastline, so asserting a literal
 *   zoom would lock in whichever constant happens to be right for one viewport today. What
 *   must stay true is the property: after framing, the frame holds a readable share of both
 *   elements.
 *
 * Why a vertex count is not what is asserted
 *   It was, and the reported screenshot passed it. Twelve points of Lake Tuz in one corner
 *   and twelve of the Gulf of Antalya in the other are twelve points. The assertion is
 *   therefore on `waterFraction`, which is what a reader actually judges.
 *
 * Why the failing width is 232 dp as well as 375
 *   Zoom is degrees per pixel. Lystra at 6.2 catches a corner of the Gulf of Antalya on a
 *   375 dp phone sheet and misses it entirely in the 232 dp tablet rail. A rule tested only
 *   at phone width would have looked correct and shipped the same picture.
 */

import { describe, expect, it } from 'vitest';

import { basemap } from './basemap';
import { frameGeography } from './frame-geography';
import {
  boundsOf,
  fitTransform,
  transformForZoom,
  zoomOf,
  type GeoPoint,
  type Viewport,
} from './projection';
import { framedTransform, mapFraming, MIN_MAP_ZOOM } from './map-framing';

/** The narrowest home a site map has: the fixed tablet context rail, minus its padding. */
const RAIL: Viewport = { width: 232, height: 172 };

/** The phone bottom sheet. */
const PHONE: Viewport = { width: 375, height: 278 };

/** The desktop's wide rail. */
const WIDE: Viewport = { width: 512, height: 379 };

/** Lystra — the case that failed. 120 miles inland on the Anatolian plateau. */
const LYSTRA: GeoPoint = [32.3384, 37.6017];

/** Jerusalem — inland too, but close enough to the coast to have always worked. */
const JERUSALEM: GeoPoint = [35.234167, 31.776667];

/** Babylon — measurably landlocked: no zoom down to the floor finds enough water. */
const BABYLON: GeoPoint = [44.420833, 32.536389];

/** The zoom `CitySiteMap` prefers for a point-like settlement. */
const PREFERRED = 6.2;

/** Mirrors the module's own threshold; see its comment for the measurements behind it. */
const MIN_WATER_FOR_TEST = 0.18;

/** How much of the frame is water at a site, viewport and zoom. */
function waterAt(point: GeoPoint, viewport: Viewport, zoom: number): number {
  return frameGeography(
    [...basemap.land, ...basemap.lakes],
    transformForZoom(point, zoom, viewport),
    viewport,
  ).waterFraction;
}

describe('mapFraming', () => {
  it('leaves a site that already sees the coast exactly where it was', () => {
    expect(waterAt(JERUSALEM, PHONE, PREFERRED)).toBeGreaterThanOrEqual(MIN_WATER_FOR_TEST);
    expect(mapFraming(JERUSALEM, PHONE, PREFERRED)).toEqual({
      zoom: PREFERRED,
      framed: true,
      coastless: false,
    });
  });

  it('is the defect itself: Lystra opens on a frame that is almost all land', () => {
    for (const viewport of [RAIL, PHONE]) {
      expect(waterAt(LYSTRA, viewport, PREFERRED)).toBeLessThan(MIN_WATER_FOR_TEST);
    }
  });

  it('widens an inland site until land and water share the frame, at every width', () => {
    for (const viewport of [RAIL, PHONE, WIDE]) {
      const framing = mapFraming(LYSTRA, viewport, PREFERRED);

      expect(framing.framed, `Lystra is unframed at ${String(viewport.width)} dp`).toBe(true);
      expect(
        waterAt(LYSTRA, viewport, framing.zoom),
        `Lystra is still nearly all land at ${String(viewport.width)} dp`,
      ).toBeGreaterThanOrEqual(MIN_WATER_FOR_TEST);
    }
  });

  it('never widens further than it has to', () => {
    const framing = mapFraming(LYSTRA, RAIL, PREFERRED);

    expect(framing.zoom).toBeLessThan(PREFERRED);
    expect(framing.zoom).toBeGreaterThan(MIN_MAP_ZOOM);
  });

  it('says so, rather than widening forever, for a site no zoom can put water beside', () => {
    const framing = mapFraming(BABYLON, RAIL, PREFERRED);

    expect(framing.zoom).toBe(MIN_MAP_ZOOM);
    expect(framing.framed).toBe(false);
    // Babylon still draws the head of the Persian Gulf at the floor, so the map is not
    // coastless and must not claim to be — the note is about the frame, not the site.
    expect(framing.coastless).toBe(false);
  });

  it('terminates at the floor and reports a coastless frame outside the basemap crop', () => {
    // Mid-Pacific: outside the cropped basemap entirely, so no step can ever find land.
    // The rule must stop at a stated floor, not run to zero and draw the whole planet.
    expect(mapFraming([-150, 0], PHONE, PREFERRED)).toEqual({
      zoom: MIN_MAP_ZOOM,
      framed: false,
      coastless: true,
    });
  });
});

describe('framedTransform', () => {
  const FIT = { padding: 28, fallbackZoom: 8 };

  /** Mark 11: Jerusalem, Bethphage, Bethany, the Mount of Olives — 0.022 degrees apart. */
  const MARK_11: readonly GeoPoint[] = [
    [35.2342, 31.7767],
    [35.2548, 31.7783],
    [35.2564, 31.7714],
    [35.2456, 31.7783],
  ];

  /** Acts 21: Cos to Syria, nine degrees across. Already wider than the floor. */
  const ACTS_21: readonly GeoPoint[] = [
    [27.2833, 36.8933],
    [35.5, 33.9],
    [30.4708, 36.2653],
    [33.0, 35.0],
  ];

  /** Fit a set of pins the way `useRouteGeometry` does. */
  function fitOf(points: readonly GeoPoint[], viewport: Viewport) {
    const bounds = boundsOf(points);
    if (bounds === null) throw new Error('no bounds');
    return fitTransform(bounds, viewport, FIT);
  }

  it('widens a fit that framed nothing but the pins', () => {
    const fitted = fitOf(MARK_11, PHONE);
    const framed = framedTransform(fitted, PHONE);

    expect(zoomOf(framed)).toBeLessThan(zoomOf(fitted));
    expect(framed.scale).toBeLessThan(fitted.scale);
  });

  it('leaves a fit that already had geography in it exactly where it was', () => {
    const fitted = fitOf(ACTS_21, PHONE);
    expect(framedTransform(fitted, PHONE)).toEqual(fitted);
  });

  it('never narrows, so a pin the fit included is still on the map', () => {
    for (const points of [MARK_11, ACTS_21]) {
      for (const viewport of [RAIL, PHONE, WIDE]) {
        const fitted = fitOf(points, viewport);
        const framed = framedTransform(fitted, viewport);
        expect(framed.scale).toBeLessThanOrEqual(fitted.scale + 1e-9);
      }
    }
  });

  it('widens about the centre of the frame, so the pins stay in the middle', () => {
    const fitted = fitOf(MARK_11, PHONE);
    const framed = framedTransform(fitted, PHONE);
    const centreX = PHONE.width / 2;
    const centreY = PHONE.height / 2;

    // The world point under the middle pixel is unchanged by the widening.
    expect((centreX - framed.offsetX) / framed.scale).toBeCloseTo(
      (centreX - fitted.offsetX) / fitted.scale,
      9,
    );
    expect((centreY - framed.offsetY) / framed.scale).toBeCloseTo(
      (centreY - fitted.offsetY) / fitted.scale,
      9,
    );
  });

  it('returns a degenerate transform untouched rather than dividing by its scale', () => {
    const broken = { scale: 0, offsetX: 0, offsetY: 0 };
    expect(framedTransform(broken, PHONE)).toEqual(broken);
  });
});
