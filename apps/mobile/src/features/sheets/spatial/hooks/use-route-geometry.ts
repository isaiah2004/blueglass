/**
 * Where the pins land, and which of them may show their name.
 *
 * Purpose
 *   `RouteMap` composes four layers; this hook is the arithmetic underneath them — fit the
 *   pins to the measured viewport, project each one, then ask `label-declutter` which names
 *   fit without colliding. Extracted from the component because rule 5.4.3 caps a function
 *   at fifty lines and because a projection is testable without a renderer.
 *
 * Why the camera is fitted rather than taken from the payload
 *   The server computes a `camera` without knowing whether it will land in a 360 dp phone
 *   sheet or a 640 dp desktop rail, so the pins' own bounding box is fitted to whatever the
 *   viewport turned out to be. The payload camera is still honoured where there is nothing
 *   to fit; see `CitySiteMap`.
 *
 * Why the fit is not the last word
 *   A bounding box says how far apart the pins are and nothing about what is around them.
 *   Mark 11 names Jerusalem, Bethphage, Bethany and the Mount of Olives — 0.022 degrees
 *   apart — and the fitted frame is a flat field with four dots on it, which is the same
 *   defect the site map was reported for. `geo/map-framing.ts` widens such a fit until
 *   there is geography in it, and never narrows one.
 *
 * Dependencies
 *   The geo layer and the declutter rule. No React Native, no SVG.
 */

import { useMemo } from 'react';

import { selectLabels, type PlateBox } from '../components/label-declutter';
import { framedTransform } from '../geo/map-framing';
import {
  boundsOf,
  fitTransform,
  project,
  type GeoPoint,
  type MapTransform,
  type ScreenPoint,
  type Viewport,
} from '../geo/projection';

/** The default for a map with no key over it. Module-level, so it is referentially stable. */
const NOTHING_RESERVED: readonly PlateBox[] = [];

/** One place the map has to draw. */
export interface RouteMapPin {
  /** Stable key, from the route view model. */
  readonly key: string;
  /** The place name. */
  readonly name: string;
  /** `[longitude, latitude]`. */
  readonly coordinates: GeoPoint;
}

/** One projected pin, ready to draw. */
export interface PlacedPin {
  readonly key: string;
  readonly name: string;
  readonly point: ScreenPoint;
  /** True for the first and last pin, which are drawn a little larger. */
  readonly emphasised: boolean;
}

/** What the map needs in order to draw anything. */
export interface RouteGeometry {
  /** The fitted transform, or `null` before layout has measured the frame. */
  readonly transform: MapTransform | null;
  /** Every pin, projected. Empty until there is a transform. */
  readonly pins: readonly PlacedPin[];
  /** The keys of the pins whose names fit without colliding. */
  readonly labelled: ReadonlySet<string>;
}

/** How the fit is tuned. */
export interface RouteGeometryOptions {
  /** Pixels kept clear around the fitted set, so an edge pin is not half-drawn. */
  readonly padding: number;
  /** Zoom used when every pin shares one point — no span to fit. */
  readonly fallbackZoom: number;
  /** Label size, which must match `MapMarker`'s so decluttering measures what is drawn. */
  readonly labelSize: number;
}

/**
 * Place the pins for one map.
 *
 * @param pins - The places to draw, in the order the payload lists them.
 * @param viewport - The measured pixel box, or `null` before the first layout pass.
 * @param options - See {@link RouteGeometryOptions}.
 * @param reserved - Rectangles a label may not sit under — the map's key. Memoise it; it
 *   is a dependency of the declutter pass.
 * @returns See {@link RouteGeometry}. Side effects: none.
 */
export function useRouteGeometry(
  pins: readonly RouteMapPin[],
  viewport: Viewport | null,
  options: RouteGeometryOptions,
  reserved: readonly PlateBox[] = NOTHING_RESERVED,
): RouteGeometry {
  const { padding, fallbackZoom, labelSize } = options;

  const transform = useMemo(() => {
    if (viewport === null) return null;
    const bounds = boundsOf(pins.map((pin) => pin.coordinates));
    if (bounds === null) return null;
    // Fit to the pins, then widen if that fit framed nothing: Mark 11's four places span
    // 0.022 degrees and fit to a flat field with four dots on it. `map-framing` only ever
    // widens, so every pin the fit included is still included.
    return framedTransform(fitTransform(bounds, viewport, { padding, fallbackZoom }), viewport);
  }, [pins, viewport, padding, fallbackZoom]);

  const placed = useMemo(() => {
    if (transform === null) return [];
    const last = pins.length - 1;
    return pins.map((pin, index) => ({
      key: pin.key,
      name: pin.name,
      point: project(transform, pin.coordinates),
      emphasised: index === 0 || index === last,
    }));
  }, [pins, transform]);

  const labelled = useMemo(
    () =>
      viewport === null ? new Set<string>() : selectLabels(placed, labelSize, viewport, reserved),
    [placed, viewport, labelSize, reserved],
  );

  return { transform, pins: placed, labelled };
}
