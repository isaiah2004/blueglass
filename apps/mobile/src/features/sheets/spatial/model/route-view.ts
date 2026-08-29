/**
 * The `[Route]` payload, turned into exactly what the sheet draws.
 *
 * Purpose
 *   Keep every decision about *what to say* out of the components. The sheet renders a
 *   title, a subtitle, a method line, a stat strip, a map and a place list; this module
 *   decides what goes in each of them, so those decisions are testable without a renderer.
 *
 * The honesty rules encoded here
 *   - The waypoints are the places the passage NAMES, in the order it names them, and
 *     nothing here may say otherwise. Under `scheme = 'chapter'` the server derives them
 *     by reading the place names out of the text, which cannot tell a place travelled
 *     through from a place merely mentioned — Acts 16 names Jerusalem, refuses Bithynia
 *     and reaches Thyatira only as Lydia's home town. So there are no stops, no legs and
 *     no journey in this file.
 *   - Distance is therefore a **span**, not a path: how far apart the two furthest-apart
 *     places are. That figure is order-independent, so it cannot be read as a distance
 *     anybody covered. The summed-legs figure that used to sit here was captioned
 *     `STRAIGHT LINE`, which sounded careful and still measured a route nobody took.
 *   - Duration is **absent**. `image1.png` prints "2 Days / Estimated Travel"; nothing in
 *     `data/raw/` records a sailing time, so the stat does not exist rather than being
 *     estimated (`spatial-badge.types.ts`, and pillar 3).
 *   - A stat whose value cannot be computed is **dropped**, not shown as a dash. A stat
 *     strip with a hole in it invites the reader to assume zero.
 *
 * Dependencies
 *   `../geo/distance`, `./passage-label`, `./spatial-payload.types`. No React.
 */

import { formatCount, formatMiles, spanMiles } from '../geo/distance';
import type { GeoPoint } from '../geo/projection';

import { formatPassage, formatVerseKey } from './passage-label';
import type { RouteSheetPayload, SpatialLocation } from './spatial-payload.types';

/** One place as the list beneath the map renders it. */
export interface RoutePlace {
  /** React key. The gazetteer id, suffixed by position, because ids repeat across kinds. */
  readonly key: string;
  /** The place. */
  readonly location: SpatialLocation;
  /** 1-based position in mention order — the order the text prints the names. */
  readonly position: number;
  /** `Acts 16:11`, or `null` when the verse key does not resolve. */
  readonly verseLabel: string | null;
}

/** One cell of the stat strip. */
export interface RouteStat {
  readonly value: string;
  readonly caption: string;
}

/** Everything the `[Route]` sheet renders. */
export interface RouteView {
  /** `Places named in this chapter`. The server's own title. */
  readonly title: string;
  /** `Acts 16:1-14`, or `null` when the passage keys do not resolve. */
  readonly passageLabel: string | null;
  /** How the list was assembled, phrased for a reader. Printed above the map. */
  readonly schemeLabel: string;
  /**
   * True when the order is the order the text names the places, and nothing more. The map
   * draws a quiet dashed connector in that case rather than §6's drawn route line.
   */
  readonly isMentionOrder: boolean;
  /** The places, in mention order. */
  readonly places: readonly RoutePlace[];
  /** The pins, ready for the projection. */
  readonly coordinates: readonly GeoPoint[];
  /** The stat strip. One or two cells; never a cell with no figure behind it. */
  readonly stats: readonly RouteStat[];
}

/**
 * Caption for the derived distance.
 *
 * One word, deliberately: three-cell strips in a 232 dp rail left about 60 px a cell and
 * the browser broke `STRAIGHT LINE` mid-word into `STRAIGH` / `T LINE`. A caption that
 * cannot be broken is the cheapest half of that fix; `components/surface/StatRow` is the
 * other half.
 */
const SPAN_CAPTION = 'SPAN';

/** Caption for how many places the passage names. */
const PLACES_CAPTION = 'PLACES';

/**
 * How each `scheme` the server can send is phrased for a reader.
 *
 * Phrased so it does not repeat the server's own title — which already says *what* the
 * pins are — and says only *how* they were ordered, which is the part a reader would
 * otherwise assume.
 */
const SCHEME_LABELS: Readonly<Record<string, string>> = {
  chapter: 'Listed in the order this chapter names them',
};

/** Fallback phrasing for a scheme this build has not been taught. */
const UNKNOWN_SCHEME = 'Listed in the order this passage names them';

/**
 * The schemes whose order is mention order rather than travel order.
 *
 * An unknown scheme is treated as mention order too: the quiet connector understates a
 * real route, whereas the drawn line overstates a list of names, and only one of those two
 * mistakes tells the reader something false.
 */
const TRAVEL_SCHEMES: readonly string[] = [];

/**
 * How a scheme is described to the reader.
 *
 * The scheme is provenance — it says how the pins on the map were assembled — so it is
 * phrased as a method, never as a claim that this is the road anyone walked. The sheet
 * prints it directly under the heading, above the map and the figures, because a caveat
 * printed below the thing it qualifies is a caveat most readers never reach.
 *
 * @param scheme - The wire value, e.g. `chapter`.
 * @returns A sentence. Side effects: none.
 */
export function schemeLabel(scheme: string): string {
  return SCHEME_LABELS[scheme] ?? UNKNOWN_SCHEME;
}

/** Build the place list, numbered in mention order. */
function toPlaces(waypoints: readonly SpatialLocation[]): readonly RoutePlace[] {
  return waypoints.map((location, index) => ({
    key: `${location.placeId}:${String(index)}`,
    location,
    position: index + 1,
    verseLabel: formatVerseKey(location.verseKey),
  }));
}

/** Build the stat strip, dropping any cell with no figure behind it. */
function toStats(
  coordinates: readonly GeoPoint[],
  places: readonly RoutePlace[],
): readonly RouteStat[] {
  const stats: RouteStat[] = [{ value: formatCount(places.length), caption: PLACES_CAPTION }];
  const span = formatMiles(spanMiles(coordinates));
  if (span !== null) stats.push({ value: span, caption: SPAN_CAPTION });
  return stats;
}

/**
 * Turn a `[Route]` payload into the sheet's view model.
 *
 * @param payload - Straight from the badge envelope.
 * @returns Everything the sheet renders. A payload with no waypoints yields empty lists
 *   and a stat strip holding only the place count, which renders as an honest empty state
 *   rather than throwing. Side effects: none.
 */
export function toRouteView(payload: RouteSheetPayload): RouteView {
  const places = toPlaces(payload.waypoints);
  const coordinates = payload.waypoints.map((waypoint) => waypoint.coordinates);
  return {
    title: payload.title,
    passageLabel: formatPassage(payload.passage),
    schemeLabel: schemeLabel(payload.scheme),
    isMentionOrder: !TRAVEL_SCHEMES.includes(payload.scheme),
    places,
    coordinates,
    stats: toStats(coordinates, places),
  };
}
