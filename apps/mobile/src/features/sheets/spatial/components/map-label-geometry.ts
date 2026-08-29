/**
 * Where a place label sits, and how big its plate is.
 *
 * Purpose
 *   SVG text has no layout: it is drawn at a point and overflows the viewport silently. A
 *   map whose easternmost pin is Thyatira will put "Thyatira" half outside the sheet unless
 *   something flips it. That something is this module, and it is pure so the flipping can
 *   be tested at every edge rather than noticed in a screenshot.
 *
 * Why the width is estimated rather than measured
 *   Measuring text in `react-native-svg` means an `onLayout` round trip and a second
 *   render per label — for twenty labels that is twenty extra renders on a sheet that must
 *   open inside `motion.duration.sheet`. The estimate below is deliberately generous: a
 *   plate slightly too wide is invisible, a plate too narrow clips the name.
 *
 * Dependencies
 *   `../geo/projection` for the point types. No React, no SVG.
 */

import type { ScreenPoint, Viewport } from '../geo/projection';

/** Which side of the pin the label sits on. */
export type LabelSide = 'right' | 'left';

/** A label's plate and where its text starts. */
export interface LabelPlacement {
  /** Left edge of the plate. */
  readonly x: number;
  /** Top edge of the plate. */
  readonly y: number;
  /** Plate width. */
  readonly width: number;
  /** Plate height. */
  readonly height: number;
  /** Where the text is anchored horizontally. */
  readonly textX: number;
  /** The text baseline. */
  readonly textY: number;
  /** Which side of the pin the plate ended up on. */
  readonly side: LabelSide;
}

/**
 * Mean advance width as a fraction of font size, for the UI sans at label sizes.
 *
 * 0.62 is the generous end of the range Inter measures across mixed-case place names; the
 * cost of over-estimating is a few invisible pixels of plate, the cost of under-estimating
 * is a clipped name.
 */
const ADVANCE_RATIO = 0.62;

/** Plate padding either side of the text, as a fraction of font size. */
const PLATE_PAD_RATIO = 0.45;

/** Plate height as a multiple of font size. */
const PLATE_HEIGHT_RATIO = 1.6;

/** Gap between the pin and its plate, as a multiple of font size. */
const PIN_GAP_RATIO = 0.7;

/**
 * How wide a label's plate needs to be.
 *
 * @param text - The place name.
 * @param fontSize - The label's font size in points.
 * @returns The plate width in pixels. Side effects: none.
 */
export function plateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * ADVANCE_RATIO + 2 * fontSize * PLATE_PAD_RATIO;
}

/**
 * Place a label beside its pin, flipping it inside the viewport when it would overflow.
 *
 * @param pin - The projected pin.
 * @param text - The place name.
 * @param fontSize - The label's font size in points.
 * @param viewport - The pixel box the map is drawn into.
 * @returns Everything the label needs to draw. The plate is clamped to the viewport on
 *   both axes, so a pin at a corner still shows its whole name. Side effects: none.
 */
export function placeLabel(
  pin: ScreenPoint,
  text: string,
  fontSize: number,
  viewport: Viewport,
): LabelPlacement {
  const width = plateWidth(text, fontSize);
  const height = fontSize * PLATE_HEIGHT_RATIO;
  const gap = fontSize * PIN_GAP_RATIO;

  const wouldOverflowRight = pin.x + gap + width > viewport.width;
  const side: LabelSide = wouldOverflowRight ? 'left' : 'right';
  const rawX = side === 'right' ? pin.x + gap : pin.x - gap - width;

  const x = Math.min(Math.max(0, rawX), Math.max(0, viewport.width - width));
  const y = Math.min(Math.max(0, pin.y - height / 2), Math.max(0, viewport.height - height));

  return {
    x,
    y,
    width,
    height,
    side,
    textX: x + fontSize * PLATE_PAD_RATIO,
    // SVG text is positioned on its baseline. Two-fifths of the font size below the
    // plate's centre puts the x-height band optically in the middle of the plate.
    textY: y + height / 2 + fontSize * 0.35,
  };
}
