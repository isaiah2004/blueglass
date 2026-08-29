/**
 * Which corner the map's key sits in, and the rectangle it reserves there.
 *
 * Purpose
 *   `MapKey` puts the sentence "Places named, not a journey" on the drawing, and its plate
 *   was handed to the label declutterer so a NAME would not land under it. The PINS were
 *   not: at tablet width on Acts 16 the Jerusalem dot was drawn underneath the plate, so a
 *   place the sheet counts, lists and cites had no visible mark on the map. A count of
 *   sixteen over a picture with fifteen dots in it is a small lie, and it is the kind a
 *   reader checks.
 *
 *   Two things fix it and both are needed. The key is drawn UNDER the pin layer, so a mark
 *   that does land on the plate is still drawn on top of it — this module's job is the
 *   other half: put the plate where the fewest marks are.
 *
 * Why the corner is chosen and not fixed
 *   `cornerPlate` already supports either bottom corner and the route map draws no scale
 *   bar, so both are free. Which one is emptier is a fact about the passage — Acts 16's
 *   pins crowd the lower left, Jonah 1's the lower right — so a fixed corner is right for
 *   about half the canon.
 *
 * Why `bottomLeft` wins a tie
 *   Reading order. A caveat found first is a caveat read, and a tie means neither corner
 *   costs a mark.
 *
 * Dependencies
 *   `../components/map-label-geometry` for the plate arithmetic and `label-declutter` for
 *   the box type. Both are pure, so this hook's rule can be tested without a renderer.
 */

import { useMemo } from 'react';

import type { PlateBox } from '../components/label-declutter';
import { mapKeyPlate, type MapCorner, type MapKeyMark } from '../components/map-label-geometry';
import type { ScreenPoint, Viewport } from '../geo/projection';

/** Nothing is reserved before layout has measured the frame. Referentially stable. */
const NOTHING_RESERVED: readonly PlateBox[] = [];

/** Preferred on a tie, and the fallback before there is a viewport to measure. */
const DEFAULT_CORNER: MapCorner = 'bottomLeft';

/** The corners a key may occupy, in preference order. */
const CANDIDATE_CORNERS: readonly MapCorner[] = [DEFAULT_CORNER, 'bottomRight'];

/** Where the key goes and what it takes up. */
export interface MapKeyPlacement {
  /** The corner to draw it in. */
  readonly corner: MapCorner;
  /** Its plate, for the label declutterer. Empty before layout. */
  readonly reserved: readonly PlateBox[];
}

/**
 * True when a point falls inside a plate.
 *
 * @param plate - The reserved rectangle.
 * @param point - A projected pin.
 * @returns Whether the plate would be drawn over the pin. Side effects: none.
 */
function covers(plate: PlateBox, point: ScreenPoint): boolean {
  return (
    point.x >= plate.x &&
    point.x <= plate.x + plate.width &&
    point.y >= plate.y &&
    point.y <= plate.y + plate.height
  );
}

/**
 * Choose the bottom corner that hides the fewest pins.
 *
 * Exported as a pure function so the choice can be tested at a pin's exact pixel rather
 * than looked at in a screenshot — which is how the Jerusalem dot went unnoticed.
 *
 * @param points - The projected pins. Pass the ones DRAWN, not the ones labelled: a pin
 *   with no room for its name is still a mark on the map.
 * @param viewport - The measured pixel box.
 * @param caption - The key's one line of text, which decides how wide its plate is.
 * @param mark - Which swatch it draws, which decides how much space precedes the text.
 * @returns See {@link MapKeyPlacement}. Side effects: none.
 */
export function quietestCorner(
  points: readonly ScreenPoint[],
  viewport: Viewport,
  caption: string,
  mark: MapKeyMark,
): MapKeyPlacement {
  let best = DEFAULT_CORNER;
  let bestPlate = mapKeyPlate(caption, mark, viewport, DEFAULT_CORNER);
  let fewest = points.filter((point) => covers(bestPlate, point)).length;
  for (const corner of CANDIDATE_CORNERS.slice(1)) {
    const plate = mapKeyPlate(caption, mark, viewport, corner);
    const hidden = points.filter((point) => covers(plate, point)).length;
    if (hidden < fewest) {
      best = corner;
      bestPlate = plate;
      fewest = hidden;
    }
  }
  return { corner: best, reserved: [bestPlate] };
}

/**
 * Memoise {@link quietestCorner} across renders.
 *
 * @param points - The projected pins.
 * @param viewport - The measured pixel box, or `null` before the first layout pass.
 * @param caption - The key's one line of text.
 * @param mark - Which swatch it draws.
 * @returns See {@link MapKeyPlacement}. Side effects: none.
 */
export function useMapKey(
  points: readonly ScreenPoint[],
  viewport: Viewport | null,
  caption: string,
  mark: MapKeyMark,
): MapKeyPlacement {
  return useMemo(
    () =>
      viewport === null
        ? { corner: DEFAULT_CORNER, reserved: NOTHING_RESERVED }
        : quietestCorner(points, viewport, caption, mark),
    [points, viewport, caption, mark],
  );
}
