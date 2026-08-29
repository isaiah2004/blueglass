/**
 * Turning projected waypoints into the SVG path the route line is drawn as.
 *
 * Purpose
 *   `design-language.md` §6: "Route lines on maps: draw progressively, gold or cyan, with
 *   a soft glow." Both halves of that live here as pure functions — the geometry of the
 *   line, and the dash arithmetic that reveals it — so the animation can be tested without
 *   a renderer and the component that draws it holds no maths.
 *
 * Why a curve, and the limit put on it
 *   `image1.png` draws a sweeping arc, not a polyline of straight legs, and a straight
 *   polyline through twenty Anatolian stops reads as a fault rather than a journey. The
 *   curve used is a **centripetal Catmull-Rom spline**, which has the one property that
 *   makes it honest here: it is an *interpolating* spline, so it passes exactly through
 *   every waypoint. The pins and the line agree by construction, and
 *   `route-path.test.ts` asserts it. Chaikin or a plain B-spline would have moved the line
 *   off the pins, which would be the drawing making a geographic claim of its own.
 *
 *   `smoothing` scales the tangents. 0 reproduces the straight polyline exactly; the
 *   default 0.5 is a gentle bow that stays visually inside the leg. Centripetal
 *   parameterisation (alpha = 0.5) is what stops a tight cluster of stops — Mysia, Troas,
 *   Bithynia within two degrees of each other — from throwing a cusp or a self-crossing
 *   loop, which uniform Catmull-Rom does.
 *
 * Dependencies
 *   `./projection` for `ScreenPoint`. No React, no SVG library: the output is a string.
 */

import type { ScreenPoint } from './projection';

/** One cubic Bezier of the route, in screen pixels. */
export interface CubicSegment {
  readonly from: ScreenPoint;
  readonly control1: ScreenPoint;
  readonly control2: ScreenPoint;
  readonly to: ScreenPoint;
}

/** The two SVG dash properties that reveal a stroke progressively. */
export interface DashState {
  /** The pattern: one dash as long as the whole path, then an equal gap. */
  readonly strokeDasharray: readonly [number, number];
  /** How much of the dash is still pulled off the start of the path. */
  readonly strokeDashoffset: number;
}

/** How much of the tangent Catmull-Rom asks for is actually used, by default. */
export const DEFAULT_SMOOTHING = 0.5;

/** Centripetal parameterisation. The value that keeps a tight cluster cusp-free. */
const ALPHA = 0.5;

/** Straight-line samples per curve when measuring length. 16 lands inside 0.05 %. */
const LENGTH_SAMPLES = 16;

/** Decimal places kept in the emitted path. 0.01 px is a tenth of a device pixel. */
const PATH_PRECISION = 2;

/** Distance between two screen points. */
function span(from: ScreenPoint, to: ScreenPoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/** Round for the path string, and never emit `-0`. */
function trim(value: number): number {
  return Number(value.toFixed(PATH_PRECISION)) + 0;
}

/**
 * Remove points that repeat their predecessor.
 *
 * A zero-length leg has no direction, which makes every tangent through it undefined. The
 * API already collapses a place named twice in a row, but two distinct places can share a
 * gazetteer pin, and rounding at low zoom can collapse two more.
 *
 * @param points - Projected waypoints in travel order.
 * @returns The same list with consecutive duplicates dropped. Side effects: none.
 */
export function dedupe(points: readonly ScreenPoint[]): readonly ScreenPoint[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return previous === undefined || span(previous, point) > 0;
  });
}

/**
 * One knot's tangent contribution, scaled by centripetal parameterisation.
 *
 * @param before - The point before the knot.
 * @param after - The point after it.
 * @param smoothing - 0 for straight legs, 1 for full Catmull-Rom tangents.
 * @param length - The leg this tangent is being applied to.
 * @returns The control-point offset from the knot. Side effects: none.
 */
function tangent(
  before: ScreenPoint,
  after: ScreenPoint,
  smoothing: number,
  length: number,
): ScreenPoint {
  const chord = span(before, after);
  if (chord === 0 || length === 0) return { x: 0, y: 0 };
  // Centripetal weighting: the tangent is scaled by the leg length relative to the chord
  // it is measured across, raised to alpha. Uniform Catmull-Rom (alpha = 0) is what
  // overshoots when one leg is far shorter than its neighbour.
  const weight = (smoothing / 3) * (length / chord) ** ALPHA;
  return { x: (after.x - before.x) * weight, y: (after.y - before.y) * weight };
}

/**
 * Build the cubic segments of the route.
 *
 * @param points - Projected waypoints in travel order.
 * @param smoothing - 0 reproduces straight legs; {@link DEFAULT_SMOOTHING} is the default bow.
 * @returns One segment per leg; empty for fewer than two distinct points. Side effects: none.
 */
export function routeSegments(
  points: readonly ScreenPoint[],
  smoothing: number = DEFAULT_SMOOTHING,
): readonly CubicSegment[] {
  const knots = dedupe(points);
  const segments: CubicSegment[] = [];
  for (let index = 0; index + 1 < knots.length; index += 1) {
    const from = knots[index]!;
    const to = knots[index + 1]!;
    const before = knots[index - 1] ?? from;
    const after = knots[index + 2] ?? to;
    const length = span(from, to);
    const out = tangent(before, to, smoothing, length);
    const back = tangent(from, after, smoothing, length);
    segments.push({
      from,
      to,
      control1: { x: from.x + out.x, y: from.y + out.y },
      control2: { x: to.x - back.x, y: to.y - back.y },
    });
  }
  return segments;
}

/**
 * The SVG `d` attribute for a set of segments.
 *
 * @param segments - From {@link routeSegments}.
 * @returns A path string, or the empty string when there is nothing to draw — an empty
 *   `d` renders nothing rather than throwing, which is what a one-stop route should do.
 *   Side effects: none.
 */
export function segmentsToPath(segments: readonly CubicSegment[]): string {
  const first = segments[0];
  if (first === undefined) return '';
  const head = `M ${trim(first.from.x)} ${trim(first.from.y)}`;
  const body = segments
    .map(
      (segment) =>
        ` C ${trim(segment.control1.x)} ${trim(segment.control1.y)}` +
        ` ${trim(segment.control2.x)} ${trim(segment.control2.y)}` +
        ` ${trim(segment.to.x)} ${trim(segment.to.y)}`,
    )
    .join('');
  return head + body;
}

/** One point on a cubic Bezier at parameter `t`. */
function pointAt(segment: CubicSegment, t: number): ScreenPoint {
  const inverse = 1 - t;
  const a = inverse ** 3;
  const b = 3 * inverse ** 2 * t;
  const c = 3 * inverse * t ** 2;
  const d = t ** 3;
  return {
    x: a * segment.from.x + b * segment.control1.x + c * segment.control2.x + d * segment.to.x,
    y: a * segment.from.y + b * segment.control1.y + c * segment.control2.y + d * segment.to.y,
  };
}

/**
 * Measure the drawn length of the route.
 *
 * The dash animation needs the length of the *curve*, not of the polyline through the same
 * points. Using the polyline would leave a visible stub undrawn at the end, because the
 * curve is always the longer of the two.
 *
 * @param segments - From {@link routeSegments}.
 * @returns Length in pixels, by flattening each segment into {@link LENGTH_SAMPLES} chords.
 *   Side effects: none.
 */
export function routeLength(segments: readonly CubicSegment[]): number {
  let total = 0;
  for (const segment of segments) {
    let previous = segment.from;
    for (let step = 1; step <= LENGTH_SAMPLES; step += 1) {
      const next = pointAt(segment, step / LENGTH_SAMPLES);
      total += span(previous, next);
      previous = next;
    }
  }
  return total;
}

/**
 * The dash properties that reveal `progress` of a path of `length`.
 *
 * @param length - From {@link routeLength}.
 * @param progress - 0 for nothing drawn, 1 for the whole line. Clamped.
 * @returns The two stroke properties. At `progress` 1 the offset is exactly 0, so the
 *   finished line carries no dash seam. Side effects: none.
 */
export function dashFor(length: number, progress: number): DashState {
  const safeLength = Number.isFinite(length) && length > 0 ? length : 0;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 1));
  return {
    strokeDasharray: [safeLength, safeLength],
    strokeDashoffset: safeLength * (1 - clamped),
  };
}
