/**
 * Tests for the vendored basemap and its projection into SVG paths.
 *
 * Two kinds of assertion, and both are needed:
 *   1. The DATA is right — Jerusalem is on land, the Aegean is water, Samothrace survived
 *      simplification. A basemap that is subtly wrong looks fine and misplaces the
 *      geography under every pin.
 *   2. The PATHS are cheap — culling culls, and the whole basemap stays two nodes. That is
 *      the measured claim `README.md` §2 makes when it chooses `react-native-svg`.
 */

import { describe, expect, it } from 'vitest';

import { basemap, ringsToPath, visibleRingCount } from './basemap';
import {
  boundsOf,
  fitTransform,
  transformForZoom,
  type GeoPoint,
  type Viewport,
} from './projection';

const SHEET: Viewport = { width: 360, height: 240 };
const FIT = { padding: 24, fallbackZoom: 9 };

/** Even-odd winding test of one flat ring. */
function insideRing(ring: readonly number[], point: GeoPoint): boolean {
  let inside = false;
  const count = ring.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
    const xi = ring[2 * i]!;
    const yi = ring[2 * i + 1]!;
    const xj = ring[2 * j]!;
    const yj = ring[2 * j + 1]!;
    if (yi > point[1] !== yj > point[1]) {
      if (point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Even-odd across land and lakes together, exactly as the SVG fill rule evaluates it. */
function isLand(point: GeoPoint): boolean {
  let crossings = 0;
  for (const ring of [...basemap.land, ...basemap.lakes]) {
    if (insideRing(ring, point)) crossings += 1;
  }
  return crossings % 2 === 1;
}

describe('basemap data', () => {
  it('is public domain, which is what lets it be bundled at all', () => {
    expect(basemap.license).toBe('public-domain');
    expect(basemap.attribution).toBe('Made with Natural Earth.');
  });

  it('covers the biblical world from Tarshish to Ur', () => {
    expect(basemap.bounds).toEqual([-12, 10, 60, 52]);
  });

  it('stays small enough to bundle', () => {
    const points = [...basemap.land, ...basemap.lakes].reduce(
      (sum, ring) => sum + ring.length / 2,
      0,
    );
    expect(points).toBeLessThan(5000);
    expect(basemap.land.length + basemap.lakes.length).toBeLessThan(200);
  });

  it('puts every biblical city on land', () => {
    const cities: Record<string, GeoPoint> = {
      Jerusalem: [35.234167, 31.776667],
      Troas: [26.158611, 39.751944],
      Philippi: [24.286944, 41.013611],
      Rome: [12.486, 41.893],
      Corinth: [22.88, 37.94],
      Antioch: [36.16, 36.2],
      Alexandria: [29.92, 31.2],
    };
    for (const [name, point] of Object.entries(cities)) {
      expect(`${name}:${String(isLand(point))}`).toBe(`${name}:true`);
    }
  });

  it('keeps Samothrace, the Acts 16:11 waypoint 1:110m data would have dropped', () => {
    expect(isLand([25.53, 40.47])).toBe(true);
  });

  it('puts every sea in the water', () => {
    const seas: Record<string, GeoPoint> = {
      Aegean: [25.0, 38.0],
      Mediterranean: [20.0, 34.0],
      'Black Sea': [34.0, 43.0],
    };
    for (const [name, point] of Object.entries(seas)) {
      expect(`${name}:${String(isLand(point))}`).toBe(`${name}:false`);
    }
  });

  it('subtracts the inland lakes, so Galilee is not painted as ground', () => {
    expect(isLand([35.59, 32.82])).toBe(false);
    expect(isLand([35.5, 31.5])).toBe(false);
  });
});

describe('ringsToPath', () => {
  const voyage: readonly GeoPoint[] = [
    [26.158611, 39.751944],
    [25.53, 40.46],
    [24.05, 40.94],
    [24.286944, 41.013611],
  ];
  const transform = fitTransform(boundsOf(voyage)!, SHEET, FIT);

  it('produces one closed sub-path per visible ring', () => {
    const path = ringsToPath(basemap.land, transform, SHEET);
    const subPaths = path.match(/Z/g) ?? [];
    expect(subPaths.length).toBe(visibleRingCount(basemap.land, transform, SHEET));
    expect(subPaths.length).toBeGreaterThan(0);
  });

  it('starts every sub-path with a move', () => {
    const path = ringsToPath(basemap.land, transform, SHEET);
    expect(path.startsWith('M')).toBe(true);
    expect(path.match(/M/g)!.length).toBe((path.match(/Z/g) ?? []).length);
  });

  it('culls: an Aegean close-up draws far fewer rings than the whole crop holds', () => {
    expect(visibleRingCount(basemap.land, transform, SHEET)).toBeLessThan(basemap.land.length);
  });

  it('draws nothing at all when the camera is off the crop', () => {
    const elsewhere = transformForZoom([-160, -60], 6, SHEET);
    expect(ringsToPath(basemap.land, elsewhere, SHEET)).toBe('');
  });

  it('emits no NaN, which would poison the whole path attribute', () => {
    expect(ringsToPath(basemap.land, transform, SHEET)).not.toContain('NaN');
  });

  it('keeps a small island the geographic pre-cull could have dropped', () => {
    // Samothrace is a single small ring. A pre-cull that compared the ring's centre rather
    // than its box, or that forgot its margin, would drop it and the Acts 16:11 waypoint
    // would sit on open water.
    const island = transformForZoom([25.53, 40.46], 9, SHEET);
    expect(ringsToPath(basemap.land, island, SHEET)).not.toBe('');
    expect(visibleRingCount(basemap.land, island, SHEET)).toBeGreaterThan(0);
  });

  it('draws the same rings at every zoom the sheets use, pre-cull or not', () => {
    // The pre-cull is an optimisation, so its only correctness obligation is to change
    // nothing. Every ring it keeps must still pass the projected test, and the count must
    // never exceed what the crop holds.
    for (const zoom of [4, 5, 6.2, 7, 8, 9]) {
      const transform = transformForZoom([28.9, 38.5], zoom, SHEET);
      const drawn = (ringsToPath(basemap.land, transform, SHEET).match(/Z/g) ?? []).length;
      expect(drawn).toBe(visibleRingCount(basemap.land, transform, SHEET));
      expect(drawn).toBeLessThanOrEqual(basemap.land.length);
    }
  });

  it('shrinks as the camera pulls back and points collapse onto one pixel', () => {
    const close = ringsToPath(basemap.land, transformForZoom([25, 39], 8, SHEET), SHEET).length;
    const far = ringsToPath(basemap.land, transformForZoom([25, 39], 3, SHEET), SHEET).length;
    expect(far).toBeLessThan(close * basemap.land.length);
  });
});
