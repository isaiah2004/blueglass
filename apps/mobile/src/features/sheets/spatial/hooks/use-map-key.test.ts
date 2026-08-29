/**
 * Where the map's key sits, tested at a pin's exact pixel.
 *
 * The defect this exists for was invisible in every screenshot but one: at tablet width on
 * Acts 16 the Jerusalem dot was drawn underneath the key's plate, so a place the sheet
 * counted, listed and cited had no mark on the map. A count of sixteen over fifteen
 * visible dots is a small lie, and it is the kind a reader checks.
 */

import { describe, expect, it } from 'vitest';

import { quietestCorner } from './use-map-key';

const VIEWPORT = { width: 600, height: 388 };
const CAPTION = 'Places named, not a journey';

/** A point inside whichever corner plate the caption produces. */
function insideCorner(corner: 'bottomLeft' | 'bottomRight'): { x: number; y: number } {
  const { reserved } = quietestCorner([], VIEWPORT, CAPTION, 'place');
  const plate = reserved[0]!;
  const x = corner === 'bottomLeft' ? plate.x + 2 : VIEWPORT.width - plate.width + 2;
  return { x, y: plate.y + 2 };
}

describe('quietestCorner', () => {
  it('prefers the bottom left when neither corner costs a mark', () => {
    // Reading order: a caveat found first is a caveat read.
    expect(quietestCorner([], VIEWPORT, CAPTION, 'place').corner).toBe('bottomLeft');
  });

  it('moves out of the corner a pin occupies', () => {
    expect(quietestCorner([insideCorner('bottomLeft')], VIEWPORT, CAPTION, 'place').corner).toBe(
      'bottomRight',
    );
  });

  it('stays put when the other corner is no better', () => {
    const both = [insideCorner('bottomLeft'), insideCorner('bottomRight')];

    expect(quietestCorner(both, VIEWPORT, CAPTION, 'place').corner).toBe('bottomLeft');
  });

  it('reserves the plate it actually chose, so the declutterer measures the drawn one', () => {
    const { corner, reserved } = quietestCorner(
      [insideCorner('bottomLeft')],
      VIEWPORT,
      CAPTION,
      'place',
    );

    expect(corner).toBe('bottomRight');
    expect(reserved).toHaveLength(1);
    // A right-hand plate ends at the viewport's right inset, not at the left one.
    expect(reserved[0]!.x + reserved[0]!.width).toBeGreaterThan(VIEWPORT.width / 2);
  });
});
