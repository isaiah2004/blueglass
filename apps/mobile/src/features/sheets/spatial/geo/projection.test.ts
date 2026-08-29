/**
 * Tests for the Mercator projection and viewport fitting.
 *
 * These are the arithmetic the whole spatial feature rests on: if `project` is wrong,
 * every pin is in the wrong place and nothing else in the sheet can reveal it. So the
 * assertions are against independently known values — Greenwich, the equator, a published
 * Mercator y for 40 N — rather than against the implementation's own output.
 */

import { describe, expect, it } from 'vitest';

import {
  boundsOf,
  clampLatitude,
  fitTransform,
  mercatorX,
  mercatorY,
  project,
  transformForZoom,
  zoomOf,
  type GeoPoint,
  type Viewport,
} from './projection';

/** Troas, Samothrace, Neapolis, Philippi — the Acts 16:11-12 voyage the mockup draws. */
const ACTS_16_VOYAGE: readonly GeoPoint[] = [
  [26.158611, 39.751944],
  [25.53, 40.46],
  [24.05, 40.94],
  [24.286944, 41.013611],
];

const SHEET: Viewport = { width: 360, height: 240 };

describe('mercatorX', () => {
  it('puts Greenwich at the middle of the world', () => {
    expect(mercatorX(0)).toBe(0.5);
  });

  it('puts the antimeridian at both ends', () => {
    expect(mercatorX(-180)).toBe(0);
    expect(mercatorX(180)).toBe(1);
  });

  it('is linear in longitude', () => {
    expect(mercatorX(90) - mercatorX(0)).toBeCloseTo(mercatorX(0) - mercatorX(-90), 12);
  });
});

describe('mercatorY', () => {
  it('puts the equator at the middle of the world', () => {
    expect(mercatorY(0)).toBeCloseTo(0.5, 12);
  });

  it('grows downwards, so a northern latitude is above a southern one', () => {
    expect(mercatorY(40)).toBeLessThan(mercatorY(30));
  });

  it('matches the Mercator ordinate for 40 N computed from the closed form', () => {
    // y = 0.5 - ln(tan(45deg + 20deg)) / 2pi. tan(65 deg) = 2.1445069205, ln of that is
    // 0.7628723123, divided by 2pi is 0.1214208423, so y = 0.3785791577.
    expect(mercatorY(40)).toBeCloseTo(
      0.5 - Math.log(Math.tan((65 * Math.PI) / 180)) / (2 * Math.PI),
      12,
    );
    expect(mercatorY(40)).toBeCloseTo(0.3785791577, 9);
  });

  it('is symmetric about the equator', () => {
    expect(mercatorY(35) + mercatorY(-35)).toBeCloseTo(1, 12);
  });

  it('never runs away at the poles', () => {
    expect(Number.isFinite(mercatorY(90))).toBe(true);
    expect(Number.isFinite(mercatorY(-90))).toBe(true);
    expect(mercatorY(90)).toBe(mercatorY(clampLatitude(90)));
  });
});

describe('boundsOf', () => {
  it('returns null for no points, because there is no map to draw', () => {
    expect(boundsOf([])).toBeNull();
  });

  it('frames a single point as a box with no span', () => {
    expect(boundsOf([[26.158611, 39.751944]])).toEqual({
      minLon: 26.158611,
      maxLon: 26.158611,
      minLat: 39.751944,
      maxLat: 39.751944,
    });
  });

  it('frames the Acts 16 voyage', () => {
    expect(boundsOf(ACTS_16_VOYAGE)).toEqual({
      minLon: 24.05,
      maxLon: 26.158611,
      minLat: 39.751944,
      maxLat: 41.013611,
    });
  });
});

describe('transformForZoom', () => {
  it('uses Mapbox world sizes, so the API camera means what it says', () => {
    expect(transformForZoom([0, 0], 0, SHEET).scale).toBe(512);
    expect(transformForZoom([0, 0], 4, SHEET).scale).toBe(8192);
  });

  it('places the centre in the middle of the viewport', () => {
    const transform = transformForZoom([26.158611, 39.751944], 6, SHEET);
    const point = project(transform, [26.158611, 39.751944]);
    expect(point.x).toBeCloseTo(SHEET.width / 2, 9);
    expect(point.y).toBeCloseTo(SHEET.height / 2, 9);
  });

  it('round-trips through zoomOf', () => {
    expect(zoomOf(transformForZoom([0, 0], 4.39, SHEET))).toBeCloseTo(4.39, 12);
  });
});

describe('fitTransform', () => {
  const options = { padding: 24, fallbackZoom: 9 };

  it('keeps every point inside the padded box', () => {
    const bounds = boundsOf(ACTS_16_VOYAGE);
    expect(bounds).not.toBeNull();
    const transform = fitTransform(bounds!, SHEET, options);
    for (const waypoint of ACTS_16_VOYAGE) {
      const { x, y } = project(transform, waypoint);
      expect(x).toBeGreaterThanOrEqual(options.padding - 0.001);
      expect(x).toBeLessThanOrEqual(SHEET.width - options.padding + 0.001);
      expect(y).toBeGreaterThanOrEqual(options.padding - 0.001);
      expect(y).toBeLessThanOrEqual(SHEET.height - options.padding + 0.001);
    }
  });

  it('touches the limiting edge, so the fit is tight and not merely safe', () => {
    const bounds = boundsOf(ACTS_16_VOYAGE);
    const transform = fitTransform(bounds!, SHEET, options);
    const north = project(transform, [bounds!.minLon, bounds!.maxLat]);
    const south = project(transform, [bounds!.minLon, bounds!.minLat]);
    // Mercator stretches this latitude band by 1/cos(40 deg) = 1.31, which makes the
    // 1.26 deg of latitude taller on screen than the 2.11 deg of longitude is wide. Height
    // is therefore what binds, and the fit must use every pixel of it.
    expect(south.y - north.y).toBeCloseTo(SHEET.height - 2 * options.padding, 6);
  });

  it('centres the box in world space, not on the mean latitude', () => {
    const bounds = boundsOf(ACTS_16_VOYAGE);
    const transform = fitTransform(bounds!, SHEET, options);
    const north = project(transform, [bounds!.minLon, bounds!.maxLat]);
    const south = project(transform, [bounds!.maxLon, bounds!.minLat]);
    expect((north.x + south.x) / 2).toBeCloseTo(SHEET.width / 2, 9);
    expect((north.y + south.y) / 2).toBeCloseTo(SHEET.height / 2, 9);
  });

  it('falls back to a fixed zoom for a single pin rather than dividing by zero', () => {
    const bounds = boundsOf([[24.286944, 41.013611]]);
    const transform = fitTransform(bounds!, SHEET, options);
    expect(Number.isFinite(transform.scale)).toBe(true);
    expect(zoomOf(transform)).toBeCloseTo(options.fallbackZoom, 12);
  });

  it('fits the other axis when a box has span in only one', () => {
    const transform = fitTransform(
      { minLon: 24, maxLon: 26, minLat: 40, maxLat: 40 },
      SHEET,
      options,
    );
    const west = project(transform, [24, 40]);
    const east = project(transform, [26, 40]);
    expect(east.x - west.x).toBeCloseTo(SHEET.width - 2 * options.padding, 6);
  });

  it('never produces a zero-width scale for a viewport smaller than its padding', () => {
    const transform = fitTransform(
      { minLon: 24, maxLon: 26, minLat: 40, maxLat: 41 },
      { width: 10, height: 10 },
      options,
    );
    expect(transform.scale).toBeGreaterThan(0);
  });
});

describe('project', () => {
  it('keeps longitude on x and latitude on y — the axis-order trap', () => {
    const transform = transformForZoom([0, 0], 4, SHEET);
    const east = project(transform, [10, 0]);
    const north = project(transform, [0, 10]);
    expect(east.x).toBeGreaterThan(SHEET.width / 2);
    expect(east.y).toBeCloseTo(SHEET.height / 2, 9);
    expect(north.y).toBeLessThan(SHEET.height / 2);
    expect(north.x).toBeCloseTo(SHEET.width / 2, 9);
  });

  it('orders the Acts 16 voyage west-to-east as the geography does', () => {
    const bounds = boundsOf(ACTS_16_VOYAGE);
    const transform = fitTransform(bounds!, SHEET, { padding: 24, fallbackZoom: 9 });
    const [troas, samothrace, neapolis] = ACTS_16_VOYAGE.map((point) => project(transform, point));
    // Neapolis is the westernmost of the three, Troas the easternmost.
    expect(neapolis!.x).toBeLessThan(samothrace!.x);
    expect(samothrace!.x).toBeLessThan(troas!.x);
    // And Troas is the southernmost, so it sits lowest on the screen.
    expect(troas!.y).toBeGreaterThan(samothrace!.y);
  });
});
