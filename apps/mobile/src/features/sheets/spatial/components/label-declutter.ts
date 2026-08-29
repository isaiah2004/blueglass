/**
 * Deciding which pins get a name printed on the map.
 *
 * Purpose
 *   Acts 16 names sixteen places, and at sheet size several of them are within a few pixels
 *   of each other — Mysia, Bithynia and Troas sit inside two degrees. Labelling all sixteen
 *   produces a stack of overlapping plates that hides the coastline and reads as a bug.
 *   Every real map declutters; this is the rule this one uses, as a pure function so the
 *   outcome is asserted rather than eyeballed.
 *
 * The rule
 *   Greedy, in priority order. A label is kept when its plate touches no plate already
 *   kept. Priority is: the first and last pin, then the rest in the order the payload lists
 *   them. That is a **layout** tie-break and not a claim — the first and last pins sit at
 *   the extremes of the reading order, so labelling them first spreads the names across the
 *   frame instead of clustering them. Nothing downstream reads a meaning into it; the sheet
 *   no longer calls any pin a departure or a destination.
 *
 * What a reserved box is for
 *   The map's own key is drawn in a corner, and a pin label that lands under it is hidden
 *   by a plate rather than read — which is what the desktop rail did to "Jerusalem". The
 *   key's plate is therefore handed in as an already-kept rectangle, so a name that would
 *   collide with it is dropped by the same rule that drops a name colliding with another
 *   name. The pin is still drawn and the place is still in the list underneath.
 *
 * What is NOT done, deliberately
 *   No label is moved to make it fit. Moving a label away from its pin is how a map ends up
 *   attaching a name to the wrong dot, and the pin is still drawn and still in the place
 *   list underneath — so a dropped label costs the reader nothing but a glance.
 *
 * Dependencies
 *   `../geo/projection` and `./map-label-geometry`. No React.
 */

import type { ScreenPoint, Viewport } from '../geo/projection';

import { placeLabel } from './map-label-geometry';

/** The part of a placement a collision test actually reads. */
export interface PlateBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One candidate label. */
export interface LabelCandidate {
  /** Stable key — the caller's own, so the result can be joined back to its place. */
  readonly key: string;
  /** The place name. */
  readonly name: string;
  /** The projected pin. */
  readonly point: ScreenPoint;
  /** True for the first and last pin: labelled first, and never dropped for a middle one. */
  readonly emphasised: boolean;
}

/** Pixels of clear space required between two plates. */
const LABEL_GUTTER = 2;

/** Do two plates overlap, allowing for the gutter? */
function collides(a: PlateBox, b: PlateBox): boolean {
  return (
    a.x < b.x + b.width + LABEL_GUTTER &&
    b.x < a.x + a.width + LABEL_GUTTER &&
    a.y < b.y + b.height + LABEL_GUTTER &&
    b.y < a.y + a.height + LABEL_GUTTER
  );
}

/** Emphasised pins first, then payload order. Stable, so equal ranks keep their order. */
function byPriority(candidates: readonly LabelCandidate[]): readonly LabelCandidate[] {
  const emphasised = candidates.filter((candidate) => candidate.emphasised);
  const rest = candidates.filter((candidate) => !candidate.emphasised);
  return [...emphasised, ...rest];
}

/**
 * Choose which candidates may print their name.
 *
 * @param candidates - Every pin, in the order the payload lists them.
 * @param fontSize - The label font size, which decides plate size.
 * @param viewport - The pixel box the map is drawn into.
 * @param reserved - Rectangles already occupied by something that is not a label — today,
 *   the map's key. Defaults to none.
 * @returns The keys that may be labelled. Every other place still draws its pin.
 *   Side effects: none.
 */
export function selectLabels(
  candidates: readonly LabelCandidate[],
  fontSize: number,
  viewport: Viewport,
  reserved: readonly PlateBox[] = [],
): ReadonlySet<string> {
  const kept: PlateBox[] = [...reserved];
  const keys = new Set<string>();

  for (const candidate of byPriority(candidates)) {
    if (keys.has(candidate.key)) continue;
    const placement = placeLabel(candidate.point, candidate.name, fontSize, viewport);
    if (kept.some((existing) => collides(existing, placement))) continue;
    kept.push(placement);
    keys.add(candidate.key);
  }

  return keys;
}
