/**
 * Web Mercator projection and viewport fitting for the spatial sheets.
 *
 * Purpose
 *   Decision `M-01` rules out a tile provider, so nothing else in the app turns a
 *   longitude and latitude into a pixel. This module is that one place: pure arithmetic,
 *   no React, no SVG, so the maths that decides where a pin lands can be tested without
 *   rendering anything.
 *
 * Why Mercator and not equirectangular
 *   Both are acceptable for the Mediterranean, and Mercator was chosen for two concrete
 *   reasons rather than convention. First, it is conformal: at 40 N an equirectangular
 *   projection stretches the Aegean 1.31x horizontally, which visibly flattens the islands
 *   the Acts 16 route threads between. Second, the API's `camera.zoom_level` is a
 *   Mapbox-style zoom (`badges/domain/camera.py`), which is defined against a 512 px
 *   Mercator world; honouring that number requires the same projection that produced it.
 *
 * Axis order, restated because it is the classic bug
 *   Every coordinate here is `[longitude, latitude]` — GeoJSON order, matching
 *   `packages/shared/src/geo.ts` and the API's `MappedLocationOut`. Swapping them drops
 *   every pin in the wrong hemisphere.
 *
 * Dependencies
 *   None. Standard library maths only, so this module runs under the `logic` Vitest
 *   project with no DOM and no React Native.
 */

/** A point on the earth as `[longitude, latitude]` in decimal degrees, WGS 84. */
export type GeoPoint = readonly [longitude: number, latitude: number];

/** A point in the sheet's own pixel space, y growing downwards. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** The pixel box a map is drawn into. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** A geographic rectangle, both corners inclusive. */
export interface GeoBounds {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;
}

/**
 * The affine map from normalised Mercator world units to sheet pixels.
 *
 * `scale` is the pixel width the whole world would occupy, which is exactly Mapbox's
 * `512 * 2 ** zoom`. Keeping it in those terms is what lets {@link transformForZoom}
 * consume the API's camera without a second unit system.
 */
export interface MapTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** How a fit may be adjusted. */
export interface FitOptions {
  /** Pixels kept clear on every side, so a pin at the edge is not half-drawn. */
  readonly padding: number;
  /** Zoom used when the points share a coordinate and there is no span to fit. */
  readonly fallbackZoom: number;
}

/** Mercator is undefined at the poles; this is where every implementation truncates. */
const MAX_LATITUDE = 85.05112878;

/** Pixels one world spans at zoom 0. Mapbox's constant, and the API's. */
const WORLD_SIZE_AT_ZOOM_0 = 512;

/** Degrees per radian, so the conversion is never written inline. */
const DEGREES_PER_RADIAN = 180 / Math.PI;

/**
 * Clamp a latitude into Mercator's defined range.
 *
 * @param latitude - Degrees north, any value.
 * @returns The latitude, truncated to +/- 85.05112878. Side effects: none.
 */
export function clampLatitude(latitude: number): number {
  return Math.min(MAX_LATITUDE, Math.max(-MAX_LATITUDE, latitude));
}

/**
 * Project a longitude onto the normalised world's x axis.
 *
 * @param longitude - Degrees east.
 * @returns 0 at 180 W, 0.5 at Greenwich, 1 at 180 E. Side effects: none.
 */
export function mercatorX(longitude: number): number {
  return (longitude + 180) / 360;
}

/**
 * Project a latitude onto the normalised world's y axis.
 *
 * @param latitude - Degrees north. Clamped to Mercator's range first.
 * @returns 0 at the top of the world, 1 at the bottom. Side effects: none.
 */
export function mercatorY(latitude: number): number {
  const radians = clampLatitude(latitude) / DEGREES_PER_RADIAN;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / (2 * Math.PI);
}

/**
 * The smallest rectangle containing every point.
 *
 * @param points - Any number of coordinates.
 * @returns The bounds, or `null` for an empty list — a caller with no points has no map
 *   to draw and must say so rather than render an arbitrary one. Side effects: none.
 */
export function boundsOf(points: readonly GeoPoint[]): GeoBounds | null {
  const first = points[0];
  if (first === undefined) return null;
  let bounds: GeoBounds = {
    minLon: first[0],
    maxLon: first[0],
    minLat: first[1],
    maxLat: first[1],
  };
  for (const [longitude, latitude] of points) {
    bounds = {
      minLon: Math.min(bounds.minLon, longitude),
      maxLon: Math.max(bounds.maxLon, longitude),
      minLat: Math.min(bounds.minLat, latitude),
      maxLat: Math.max(bounds.maxLat, latitude),
    };
  }
  return bounds;
}

/**
 * The transform that opens on a given centre and zoom.
 *
 * Used where there is nothing to fit: the 3D City sheet frames one pin, and a bounding
 * box of a single point has no span.
 *
 * @param centre - Where the camera looks.
 * @param zoomLevel - Mapbox-style zoom; fractional values are meaningful.
 * @param viewport - The pixel box being drawn into.
 * @returns The transform. Side effects: none.
 */
export function transformForZoom(
  centre: GeoPoint,
  zoomLevel: number,
  viewport: Viewport,
): MapTransform {
  const scale = WORLD_SIZE_AT_ZOOM_0 * 2 ** zoomLevel;
  return {
    scale,
    offsetX: viewport.width / 2 - mercatorX(centre[0]) * scale,
    offsetY: viewport.height / 2 - mercatorY(centre[1]) * scale,
  };
}

/**
 * The transform that frames `bounds` inside `viewport` as large as the padding allows.
 *
 * @param bounds - What must be visible.
 * @param viewport - The pixel box being drawn into.
 * @param options - Padding, and the zoom to fall back on for a degenerate box.
 * @returns The transform. A box with no span in either axis falls back to
 *   `options.fallbackZoom` centred on the box; a box with no span in one axis is fitted
 *   on the other. Side effects: none.
 *
 * The centring trap this function was corrected for
 *   Centring on `mercatorY(meanLatitude)` is wrong, and wrong by little enough to look
 *   right: Mercator's y is not linear in latitude, so the mean of two latitudes does not
 *   project to the midpoint of their two ordinates. For the 1.26 deg span of the Acts 16
 *   voyage that error is 0.45 px, which is invisible — and it pushes the northernmost pin
 *   outside the padding it was supposed to guarantee. The midpoint is therefore taken in
 *   world space, after projecting, never before.
 */
export function fitTransform(
  bounds: GeoBounds,
  viewport: Viewport,
  options: FitOptions,
): MapTransform {
  const left = mercatorX(bounds.minLon);
  const right = mercatorX(bounds.maxLon);
  const top = mercatorY(bounds.maxLat);
  const bottom = mercatorY(bounds.minLat);
  const usableWidth = Math.max(1, viewport.width - 2 * options.padding);
  const usableHeight = Math.max(1, viewport.height - 2 * options.padding);

  const candidates: number[] = [];
  if (right > left) candidates.push(usableWidth / (right - left));
  if (bottom > top) candidates.push(usableHeight / (bottom - top));
  if (candidates.length === 0) {
    const centre: GeoPoint = [bounds.minLon, bounds.minLat];
    return transformForZoom(centre, options.fallbackZoom, viewport);
  }

  const scale = Math.min(...candidates);
  return {
    scale,
    offsetX: viewport.width / 2 - ((left + right) / 2) * scale,
    offsetY: viewport.height / 2 - ((top + bottom) / 2) * scale,
  };
}

/**
 * Place one coordinate on the screen.
 *
 * @param transform - From {@link fitTransform} or {@link transformForZoom}.
 * @param point - `[longitude, latitude]`.
 * @returns Its pixel position within the viewport. Side effects: none.
 */
export function project(transform: MapTransform, point: GeoPoint): ScreenPoint {
  return {
    x: mercatorX(point[0]) * transform.scale + transform.offsetX,
    y: mercatorY(point[1]) * transform.scale + transform.offsetY,
  };
}

/**
 * Invert a normalised Mercator ordinate back to a latitude.
 *
 * @param worldY - 0 at the top of the world, 1 at the bottom.
 * @returns Degrees north. Side effects: none.
 */
export function latitudeAt(worldY: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY))) * 180) / Math.PI;
}

/**
 * What part of the earth is currently on screen.
 *
 * The inverse of {@link project}, applied to the viewport's four corners. Two callers need
 * it and neither should re-derive it: the graticule, to know which round degrees to draw,
 * and the basemap, to discard a coastline ring **before** projecting its points rather than
 * after — which is the difference between projecting 3,327 points on every camera change
 * and projecting only the few hundred that can be seen.
 *
 * @param transform - The map's current transform.
 * @param viewport - The pixel box.
 * @returns The visible rectangle, or `null` for a degenerate transform. Side effects: none.
 */
export function visibleBounds(transform: MapTransform, viewport: Viewport): GeoBounds | null {
  if (!Number.isFinite(transform.scale) || transform.scale <= 0) return null;
  const left = -transform.offsetX / transform.scale;
  const right = (viewport.width - transform.offsetX) / transform.scale;
  const top = -transform.offsetY / transform.scale;
  const bottom = (viewport.height - transform.offsetY) / transform.scale;
  return {
    minLon: left * 360 - 180,
    maxLon: right * 360 - 180,
    minLat: latitudeAt(bottom),
    maxLat: latitudeAt(top),
  };
}

/**
 * The coordinate at the centre of the frame.
 *
 * The inverse of {@link project} applied to the middle pixel. Framing widens a map about
 * its own centre, and it has to know which coordinate that is in order to ask what is
 * around it — see `./map-framing`.
 *
 * @param transform - The map's current transform.
 * @param viewport - The pixel box.
 * @returns `[longitude, latitude]`, or `null` for a degenerate transform. Side effects: none.
 */
export function centreOf(transform: MapTransform, viewport: Viewport): GeoPoint | null {
  if (!Number.isFinite(transform.scale) || transform.scale <= 0) return null;
  const worldX = (viewport.width / 2 - transform.offsetX) / transform.scale;
  const worldY = (viewport.height / 2 - transform.offsetY) / transform.scale;
  return [worldX * 360 - 180, latitudeAt(worldY)];
}

/**
 * The zoom a transform is currently at.
 *
 * Exposed so a sheet can report or cap its own framing; the fit is otherwise expressed
 * only as a scale.
 *
 * @param transform - Any transform.
 * @returns The equivalent Mapbox zoom level. Side effects: none.
 */
export function zoomOf(transform: MapTransform): number {
  return Math.log2(transform.scale / WORLD_SIZE_AT_ZOOM_0);
}
