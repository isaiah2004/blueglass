/**
 * Tests for the route line's geometry and its draw animation.
 *
 * The property that matters most is the first one asserted: the curve passes exactly
 * through every waypoint. A route line that drifts off its own pins would be the drawing
 * making a geographic claim the gazetteer does not support, which is a pillar-3 failure
 * dressed up as a visual flourish.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SMOOTHING,
  dashFor,
  dedupe,
  routeLength,
  routeSegments,
  segmentsToPath,
} from './route-path';
import type { ScreenPoint } from './projection';

/** A four-stop route with one very short final leg, as Neapolis to Philippi is. */
const VOYAGE: readonly ScreenPoint[] = [
  { x: 320, y: 200 },
  { x: 210, y: 120 },
  { x: 60, y: 70 },
  { x: 84, y: 62 },
];

/** Sum of the straight legs between the same points. */
function polylineLength(points: readonly ScreenPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(
      points[index]!.x - points[index - 1]!.x,
      points[index]!.y - points[index - 1]!.y,
    );
  }
  return total;
}

describe('dedupe', () => {
  it('drops a repeated point, which would make a tangent undefined', () => {
    const points = [
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ];
    expect(dedupe(points)).toEqual([
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ]);
  });

  it('keeps a point that repeats a non-adjacent one, because a route may return', () => {
    const points = [
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 10, y: 10 },
    ];
    expect(dedupe(points)).toHaveLength(3);
  });
});

describe('routeSegments', () => {
  it('emits one segment per leg', () => {
    expect(routeSegments(VOYAGE)).toHaveLength(3);
  });

  it('emits nothing for fewer than two distinct points', () => {
    expect(routeSegments([])).toEqual([]);
    expect(routeSegments([{ x: 1, y: 1 }])).toEqual([]);
    expect(
      routeSegments([
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).toEqual([]);
  });

  it('passes exactly through every waypoint', () => {
    const segments = routeSegments(VOYAGE);
    expect(segments[0]!.from).toEqual(VOYAGE[0]);
    segments.forEach((segment, index) => {
      expect(segment.to).toEqual(VOYAGE[index + 1]);
    });
  });

  it('joins each leg to the next without a gap', () => {
    const segments = routeSegments(VOYAGE);
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index]!.from).toEqual(segments[index - 1]!.to);
    }
  });

  it('reproduces straight legs when smoothing is zero', () => {
    const [segment] = routeSegments(VOYAGE, 0);
    expect(segment!.control1).toEqual(segment!.from);
    expect(segment!.control2).toEqual(segment!.to);
  });

  it('bows the line away from the straight leg when smoothing is on', () => {
    const [straight] = routeSegments(VOYAGE, 0);
    const [curved] = routeSegments(VOYAGE, DEFAULT_SMOOTHING);
    expect(curved!.control1).not.toEqual(straight!.control1);
  });

  it('keeps the bow modest — the curve is never far longer than the legs', () => {
    const curve = routeLength(routeSegments(VOYAGE, DEFAULT_SMOOTHING));
    const straight = polylineLength(VOYAGE);
    expect(curve).toBeGreaterThanOrEqual(straight - 0.001);
    expect(curve).toBeLessThan(straight * 1.12);
  });

  it('does not throw a cusp when one leg is far shorter than its neighbour', () => {
    // The Neapolis-to-Philippi leg is a twentieth of the Samothrace leg. Uniform
    // Catmull-Rom overshoots here; centripetal must not. The test for "no overshoot" is
    // that no control point leaves the leg's own bounding box by more than the leg length.
    const segments = routeSegments(VOYAGE, DEFAULT_SMOOTHING);
    const last = segments[segments.length - 1]!;
    const legLength = Math.hypot(last.to.x - last.from.x, last.to.y - last.from.y);
    const drift = Math.hypot(last.control1.x - last.from.x, last.control1.y - last.from.y);
    expect(drift).toBeLessThanOrEqual(legLength);
  });
});

describe('segmentsToPath', () => {
  it('is empty when there is nothing to draw', () => {
    expect(segmentsToPath([])).toBe('');
  });

  it('starts with a move to the first waypoint', () => {
    expect(segmentsToPath(routeSegments(VOYAGE))).toMatch(/^M 320 200 C /);
  });

  it('emits one cubic per leg', () => {
    const path = segmentsToPath(routeSegments(VOYAGE));
    expect(path.match(/ C /g)).toHaveLength(3);
  });

  it('rounds coordinates rather than emitting float noise', () => {
    const path = segmentsToPath(routeSegments(VOYAGE));
    expect(path).not.toMatch(/\d\.\d{3}/);
  });

  it('never emits a negative zero, which some SVG parsers reject', () => {
    const path = segmentsToPath(
      routeSegments([
        { x: 0, y: 0 },
        { x: -0.001, y: 10 },
      ]),
    );
    expect(path).not.toContain('-0 ');
  });
});

describe('routeLength', () => {
  it('is zero for nothing', () => {
    expect(routeLength([])).toBe(0);
  });

  it('equals the straight length when smoothing is off', () => {
    expect(routeLength(routeSegments(VOYAGE, 0))).toBeCloseTo(polylineLength(VOYAGE), 6);
  });

  it('is at least the straight length when smoothing is on, so no stub is left undrawn', () => {
    expect(routeLength(routeSegments(VOYAGE, DEFAULT_SMOOTHING))).toBeGreaterThanOrEqual(
      polylineLength(VOYAGE),
    );
  });
});

describe('dashFor', () => {
  const LENGTH = 420;

  it('hides the whole line at zero progress', () => {
    expect(dashFor(LENGTH, 0)).toEqual({
      strokeDasharray: [LENGTH, LENGTH],
      strokeDashoffset: LENGTH,
    });
  });

  it('leaves no seam at full progress', () => {
    expect(dashFor(LENGTH, 1).strokeDashoffset).toBe(0);
  });

  it('reveals proportionally in between', () => {
    expect(dashFor(LENGTH, 0.25).strokeDashoffset).toBeCloseTo(315, 9);
  });

  it('clamps progress outside 0..1 rather than inverting the dash', () => {
    expect(dashFor(LENGTH, -2).strokeDashoffset).toBe(LENGTH);
    expect(dashFor(LENGTH, 4).strokeDashoffset).toBe(0);
  });

  it('survives a degenerate length instead of emitting NaN into the DOM', () => {
    expect(dashFor(0, 0.5)).toEqual({ strokeDasharray: [0, 0], strokeDashoffset: 0 });
    expect(dashFor(Number.NaN, 0.5).strokeDashoffset).toBe(0);
  });

  it('treats a non-finite progress as finished, never as hidden', () => {
    expect(dashFor(LENGTH, Number.NaN).strokeDashoffset).toBe(0);
  });
});
