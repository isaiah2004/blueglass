/**
 * The six surface motifs, as pure per-pixel functions.
 *
 * Purpose
 *   Ports `A:\Work\spark\spark-app\app\lib\widgets\patterns.dart` (READ-ONLY source) into
 *   a form React Native can afford. The Flutter app drew each motif with a `CustomPainter`
 *   and cached the result as an `ImageShader`; RN has no `CustomPainter`, and the port
 *   map's risk #6 names the replacement — pre-baked seamless tiles, repeated.
 *
 * Why per-pixel and modular
 *   Every motif is evaluated as a function of `(x mod period, y mod period)`. Seamlessness
 *   is therefore a property of the arithmetic rather than something to eyeball: a tile
 *   *cannot* show a join, because the pixel at `x = 0` is computed from the same phase as
 *   the pixel at `x = period`.
 *
 * Output convention
 *   Each function returns coverage in `0..1`. The baker paints white at that alpha, so one
 *   tile serves both themes — the component tints it (`Image` `tintColor`).
 */

/** Softness of an edge, in pixels. Below this the tiles alias badly at 1x. */
const FEATHER = 0.9;

/**
 * Antialiased coverage for a point `distance` away from a stroke's centre line.
 *
 * @param {number} distance Absolute distance from the centre line, in pixels.
 * @param {number} halfWidth Half the stroke width, in pixels.
 * @returns {number} Coverage in `0..1`.
 */
function stroke(distance, halfWidth) {
  return Math.min(1, Math.max(0, (halfWidth + FEATHER - distance) / FEATHER));
}

/**
 * Distance from `value` to the nearest multiple of `period`.
 *
 * @param {number} value Any coordinate.
 * @param {number} period The repeat length.
 * @returns {number} A distance in `0..period/2`.
 */
function wrappedDistance(value, period) {
  const m = ((value % period) + period) % period;
  return Math.min(m, period - m);
}

/**
 * A single-direction diagonal hatch — `patterns.dart`'s `hatch`.
 *
 * @param {number} x Pixel column.
 * @param {number} y Pixel row.
 * @param {number} period Tile size.
 * @returns {number} Coverage.
 */
function hatch(x, y, period) {
  return stroke(wrappedDistance(x + y, period / 2) / Math.SQRT2, 0.5);
}

/**
 * The signature woven cross-hatch — `patterns.dart`'s `cross`.
 *
 * @param {number} x Pixel column.
 * @param {number} y Pixel row.
 * @param {number} period Tile size.
 * @returns {number} Coverage.
 */
function cross(x, y, period) {
  const forward = stroke(wrappedDistance(x + y, period / 2) / Math.SQRT2, 0.45);
  const back = stroke(wrappedDistance(x - y, period / 2) / Math.SQRT2, 0.45);
  return Math.max(forward, back);
}

/**
 * A fine square grid — `patterns.dart`'s `grid`.
 *
 * @param {number} x Pixel column.
 * @param {number} y Pixel row.
 * @param {number} period Tile size.
 * @returns {number} Coverage.
 */
function grid(x, y, period) {
  const half = period / 2;
  return Math.max(stroke(wrappedDistance(x, half), 0.4), stroke(wrappedDistance(y, half), 0.4));
}

/**
 * A calm stipple grid — `patterns.dart`'s `dots`.
 *
 * @param {number} x Pixel column.
 * @param {number} y Pixel row.
 * @param {number} period Tile size.
 * @returns {number} Coverage.
 */
function dots(x, y, period) {
  const half = period / 2;
  const dx = wrappedDistance(x - half / 2, half);
  const dy = wrappedDistance(y - half / 2, half);
  return stroke(Math.hypot(dx, dy), 1);
}

/**
 * Stacked horizontal sine waves — `patterns.dart`'s `waves`.
 *
 * @param {number} x Pixel column.
 * @param {number} y Pixel row.
 * @param {number} period Tile size.
 * @returns {number} Coverage.
 */
function waves(x, y, period) {
  const rowGap = period / 2;
  const amplitude = period / 12;
  const offset = amplitude * Math.sin((2 * Math.PI * x) / period);
  return stroke(wrappedDistance(y - offset, rowGap), 0.5);
}

/**
 * A lattice of overlapping rings — the port of `patterns.dart`'s `scale`.
 *
 * The Flutter original drew half-arcs (a fish-scale). Half-arcs cannot be wrapped by the
 * modular-distance technique this file relies on for seamlessness, so the port draws the
 * complete circle instead. It tiles perfectly and reads as the same family of motif, which
 * is why the name changed with it: this is `rings`, not `scale`.
 *
 * @param {number} x Pixel column.
 * @param {number} y Pixel row.
 * @param {number} period Tile size.
 * @returns {number} Coverage.
 */
function rings(x, y, period) {
  const radius = period / 4;
  let best = Infinity;
  for (const centre of [
    [0, 0],
    [2 * radius, 0],
    [4 * radius, 0],
    [radius, 2 * radius],
    [3 * radius, 2 * radius],
    [0, 4 * radius],
    [2 * radius, 4 * radius],
    [4 * radius, 4 * radius],
  ]) {
    const dx = wrappedDistance(x - centre[0], period);
    const dy = wrappedDistance(y - centre[1], period);
    best = Math.min(best, Math.abs(Math.hypot(dx, dy) - radius));
  }
  return stroke(best, 0.45);
}

/**
 * The motif table, keyed by the name the app uses.
 *
 * `period` is both the tile size in pixels and the motif's repeat length, which is what
 * makes every tile seamless by construction.
 */
export const MOTIFS = {
  cross: { period: 24, paint: cross },
  hatch: { period: 24, paint: hatch },
  grid: { period: 24, paint: grid },
  dots: { period: 24, paint: dots },
  waves: { period: 32, paint: waves },
  rings: { period: 32, paint: rings },
};
