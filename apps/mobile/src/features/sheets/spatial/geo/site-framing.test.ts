/**
 * Tests for the site map's framing rule.
 *
 * The defect these pin
 *   Lystra rendered as an empty graticule with one pin and no coastline — a grey blob. The
 *   fix must widen an inland site until there is something to look at, and must NOT widen a
 *   coastal one, because a Jerusalem framed like an empire is a different bug.
 *
 * Why the assertions are about what is drawn, not about the number 6.2
 *   The framing is a measurement against the vendored coastline, so asserting a literal
 *   zoom would lock in whichever constant happens to be right for one viewport today. What
 *   must stay true is the property: after framing, a coastline is drawn inside the frame.
 *
 * Why the failing width is 232 dp and not 375
 *   Zoom is degrees per pixel. Lystra at 6.2 catches the Gulf of Antalya on a 375 dp phone
 *   sheet and misses it entirely in the 232 dp tablet rail — which is the surface the defect
 *   was reported on. A rule tested only at phone width would have looked correct and shipped
 *   the same grey blob.
 */

import { describe, expect, it } from 'vitest';

import { basemap, hasCoastlineInFrame } from './basemap';
import { transformForZoom, type GeoPoint, type Viewport } from './projection';
import { MIN_SITE_ZOOM, siteZoom } from './site-framing';

/** The narrowest home a site map has: the fixed tablet context rail, minus its padding. */
const RAIL: Viewport = { width: 232, height: 172 };

/** The phone bottom sheet. */
const PHONE: Viewport = { width: 375, height: 278 };

/** Lystra — the case that failed. 120 miles inland on the Anatolian plateau. */
const LYSTRA: GeoPoint = [32.3384, 37.6017];

/** Jerusalem — inland too, but close enough to the coast to have always worked. */
const JERUSALEM: GeoPoint = [35.234167, 31.776667];

/** The zoom `CitySiteMap` prefers for a point-like settlement. */
const PREFERRED = 6.2;

/** How much of the vendored coastline is drawn inside the frame at a site and zoom. */
function coastInFrame(point: GeoPoint, viewport: Viewport, zoom: number): boolean {
  return hasCoastlineInFrame(
    [...basemap.land, ...basemap.lakes],
    transformForZoom(point, zoom, viewport),
    viewport,
    MIN_COASTLINE_POINTS_FOR_TEST,
  );
}

/** Mirrors the module's own threshold; see its comment for why it is twelve. */
const MIN_COASTLINE_POINTS_FOR_TEST = 12;

describe('siteZoom', () => {
  it('leaves a site that already sees the coast exactly where it was', () => {
    expect(coastInFrame(JERUSALEM, PHONE, PREFERRED)).toBe(true);
    expect(siteZoom(JERUSALEM, PHONE, PREFERRED)).toBe(PREFERRED);
  });

  it('is the defect itself: Lystra draws no coastline in the tablet rail', () => {
    expect(coastInFrame(LYSTRA, RAIL, PREFERRED)).toBe(false);
  });

  it('puts a coastline in frame for an inland site at every width a sheet is given', () => {
    for (const viewport of [RAIL, PHONE, { width: 512, height: 379 }]) {
      const zoom = siteZoom(LYSTRA, viewport, PREFERRED);

      expect(
        coastInFrame(LYSTRA, viewport, zoom),
        `Lystra still has no coastline at ${String(viewport.width)} dp`,
      ).toBe(true);
    }
  });

  it('never widens further than it has to', () => {
    const zoom = siteZoom(LYSTRA, RAIL, PREFERRED);

    expect(zoom).toBeLessThan(PREFERRED);
    expect(zoom).toBeGreaterThan(MIN_SITE_ZOOM);
  });

  it('terminates at the floor rather than looping when nothing is ever in frame', () => {
    // Mid-Pacific: outside the cropped basemap entirely, so no step can ever find land.
    // The rule must stop at a stated floor, not run to zero and draw the whole planet.
    expect(siteZoom([-150, 0], PHONE, PREFERRED)).toBe(MIN_SITE_ZOOM);
  });
});
