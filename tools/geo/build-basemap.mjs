/**
 * Generator for the vendored coastline basemap the spatial sheets draw.
 *
 * Purpose
 *   Decision `M-01` forbids a tile provider, so the Route and 3D City sheets draw their
 *   own map. This script turns Natural Earth's public-domain 1:50m land and lake polygons
 *   into one small JSON module the Expo bundle can carry: cropped to the biblical world,
 *   simplified, and rounded. It exists so the vendored file is reproducible rather than a
 *   binary blob nobody can regenerate.
 *
 * Run
 *   node tools/geo/build-basemap.mjs
 *
 * Inputs   data/raw/natural-earth/ne_50m_land.geojson, ne_50m_lakes.geojson
 * Output   apps/mobile/src/features/sheets/spatial/geo/basemap.data.json
 *
 * Why polygons and not a coastline LINE
 *   The sheet fills land against sea. A line string cannot be filled, and stroking a
 *   coastline leaves the two sides indistinguishable on a dark canvas.
 *
 * Why one flat ring list
 *   Every ring is emitted into a single SVG path with `fill-rule: evenodd`, so lakes and
 *   polygon holes subtract themselves and the whole basemap costs two DOM nodes. See the
 *   header of `geo/basemap.ts`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const RAW = join(ROOT, 'data', 'raw', 'natural-earth');
const OUT_DIR = join(ROOT, 'apps', 'mobile', 'src', 'features', 'sheets', 'spatial', 'geo');
const OUT = join(OUT_DIR, 'basemap.data.json');

/**
 * The biblical world, west to east and south to north, in degrees.
 * Tarshish (Spain, ~-6) to Ur (~46), Cush (~15 N) to the Black Sea's north shore (~47 N),
 * with a margin so a fitted camera never sees the crop edge.
 */
const BBOX = { minLon: -12, minLat: 10, maxLon: 60, maxLat: 52 };

/** Douglas-Peucker tolerance, in degrees. 0.02 deg is ~2 km — under one screen pixel. */
const TOLERANCE = 0.02;

/** Rings smaller than this (square degrees) vanish at sheet size; dropping them is free. */
const MIN_AREA = 0.0006;

/** Decimal places kept. 3 dp is ~110 m, an order of magnitude finer than a screen pixel. */
const PRECISION = 3;

/** Clip a ring against one bbox edge (Sutherland-Hodgman). */
function clipEdge(ring, keep, intersect) {
  const out = [];
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i];
    const previous = ring[(i + ring.length - 1) % ring.length];
    const currentIn = keep(current);
    if (currentIn !== keep(previous)) out.push(intersect(previous, current));
    if (currentIn) out.push(current);
  }
  return out;
}

/** Linear interpolation of a segment to a given longitude. */
const atLon = (lon) => (a, b) => [lon, a[1] + ((b[1] - a[1]) * (lon - a[0])) / (b[0] - a[0])];

/** Linear interpolation of a segment to a given latitude. */
const atLat = (lat) => (a, b) => [a[0] + ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]), lat];

/** Clip one closed ring to BBOX, returning [] when nothing survives. */
function clipRing(ring) {
  let clipped = ring;
  clipped = clipEdge(clipped, (p) => p[0] >= BBOX.minLon, atLon(BBOX.minLon));
  if (clipped.length === 0) return [];
  clipped = clipEdge(clipped, (p) => p[0] <= BBOX.maxLon, atLon(BBOX.maxLon));
  if (clipped.length === 0) return [];
  clipped = clipEdge(clipped, (p) => p[1] >= BBOX.minLat, atLat(BBOX.minLat));
  if (clipped.length === 0) return [];
  return clipEdge(clipped, (p) => p[1] <= BBOX.maxLat, atLat(BBOX.maxLat));
}

/** Perpendicular distance from `p` to the segment `a`-`b`, in degrees. */
function perpendicular(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const span = dx * dx + dy * dy;
  if (span === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / span));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker, iterative so a 10,000-point ring cannot blow the stack. */
function simplify(points) {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const distance = perpendicular(points[i], points[first], points[last]);
      if (distance > worst) {
        worst = distance;
        index = i;
      }
    }
    if (worst > TOLERANCE && index > 0) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Shoelace area, unsigned, in square degrees. */
function area(ring) {
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    total += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(total) / 2;
}

/** Every closed ring of a GeoJSON feature collection, whatever its geometry type. */
function ringsOf(collection) {
  const rings = [];
  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (geometry === null) continue;
    if (geometry.type === 'Polygon') rings.push(...geometry.coordinates);
    if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates) rings.push(...polygon);
    }
  }
  return rings;
}

/** Clip, simplify, drop and round one source's rings into flat coordinate arrays. */
function prepare(collection) {
  const prepared = [];
  for (const ring of ringsOf(collection)) {
    const clipped = clipRing(ring);
    if (clipped.length < 4 || area(clipped) < MIN_AREA) continue;
    const simplified = simplify(clipped);
    if (simplified.length < 4) continue;
    prepared.push(simplified.flatMap((p) => p.map((v) => Number(v.toFixed(PRECISION)))));
  }
  return prepared;
}

const land = prepare(JSON.parse(readFileSync(join(RAW, 'ne_50m_land.geojson'), 'utf8')));
const lakes = prepare(JSON.parse(readFileSync(join(RAW, 'ne_50m_lakes.geojson'), 'utf8')));

const basemap = {
  attribution: 'Made with Natural Earth.',
  license: 'public-domain',
  source: 'Natural Earth 1:50m physical vectors (land, lakes)',
  bounds: [BBOX.minLon, BBOX.minLat, BBOX.maxLon, BBOX.maxLat],
  tolerance: TOLERANCE,
  land,
  lakes,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(basemap), 'utf8');

const points = [...land, ...lakes].reduce((sum, ring) => sum + ring.length / 2, 0);
console.log(`land rings   ${land.length}`);
console.log(`lake rings   ${lakes.length}`);
console.log(`points       ${points}`);
console.log(`bytes        ${JSON.stringify(basemap).length}`);
console.log(`written      ${OUT}`);
