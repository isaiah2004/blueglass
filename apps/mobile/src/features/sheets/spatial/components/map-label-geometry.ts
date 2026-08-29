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

import { spacing, uiSize } from '@/theme';

import type { ScreenPoint, Viewport } from '../geo/projection';

/** Which corner of the map a key sits in. */
export type MapCorner = 'bottomLeft' | 'bottomRight';

/** The swatch drawn before a key's caption. */
export type MapKeyMark = 'none' | 'place' | 'journey';

/** How far a corner key is set in from the map's edges. */
export interface CornerInset {
  /** Inset from the left or right edge, in pixels. */
  readonly x: number;
  /** Inset from the bottom edge, in pixels. Stacks a key above the scale bar. */
  readonly y: number;
}

/** A corner key's plate, its mark and its text. */
export interface CornerPlacement {
  /** Left edge of the plate. */
  readonly x: number;
  /** Top edge of the plate. */
  readonly y: number;
  /** Plate width. */
  readonly width: number;
  /** Plate height. */
  readonly height: number;
  /** Horizontal centre of the mark drawn before the text. */
  readonly markX: number;
  /** Vertical centre of the plate, which the mark is drawn on. */
  readonly markY: number;
  /** Where the text is anchored horizontally. */
  readonly textX: number;
  /** The text baseline. */
  readonly textY: number;
}

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
 * How far below a plate's centre the text baseline sits, as a fraction of font size.
 *
 * SVG text is positioned on its baseline, so a glyph box centred on the plate would sit
 * high in it. Just over a third of the font size puts the x-height band optically in the
 * middle.
 */
const BASELINE_RATIO = 0.35;

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
    textY: y + height / 2 + fontSize * BASELINE_RATIO,
  };
}

/**
 * Place a key in a corner of the map.
 *
 * The map's own legend and its "no coastline in view" note are the same shape: a plate, an
 * optional mark, and one line of text, set in from a corner by the same margin the scale
 * bar uses. Sharing the arithmetic is what keeps them optically aligned with it.
 *
 * @param caption - The one line of text.
 * @param fontSize - Its font size in points.
 * @param viewport - The pixel box the map is drawn into.
 * @param corner - Which corner to sit in.
 * @param markWidth - Width reserved before the text for a swatch, or `0` for none.
 * @param inset - How far in from the edges to sit. A larger `y` stacks the key above
 *   whatever else already occupies the corner.
 * @returns Everything the key needs to draw. The plate is clamped to the viewport, so a
 *   caption wider than a narrow rail is set flush left rather than off the edge.
 *   Side effects: none.
 */
export function cornerPlate(
  caption: string,
  fontSize: number,
  viewport: Viewport,
  corner: MapCorner,
  markWidth: number,
  inset: CornerInset,
): CornerPlacement {
  const width = plateWidth(caption, fontSize) + markWidth;
  const height = fontSize * PLATE_HEIGHT_RATIO;
  const rawX = corner === 'bottomLeft' ? inset.x : viewport.width - inset.x - width;
  const x = Math.max(0, Math.min(rawX, Math.max(0, viewport.width - width)));
  const y = Math.max(0, viewport.height - inset.y - height);
  const pad = fontSize * PLATE_PAD_RATIO;

  return {
    x,
    y,
    width,
    height,
    markX: x + pad + markWidth / 2,
    markY: y + height / 2,
    textX: x + pad + markWidth,
    textY: y + height / 2 + fontSize * BASELINE_RATIO,
  };
}

/** The margin the scale bar already uses, so all the map's furniture lines up. */
export const DEFAULT_KEY_INSET: CornerInset = { x: spacing.md, y: spacing.md };

/** A key caption takes the same step as a place label: chrome over a picture, not body copy. */
export const KEY_CAPTION_SIZE = uiSize.xs;

/** Width reserved before the caption for a swatch, as a multiple of the font size. */
const MARK_WIDTH_RATIO = 1.5;

/**
 * How much room a key's swatch takes before its text.
 *
 * @param mark - Which swatch, or `none`.
 * @returns The reserved width in pixels. Side effects: none.
 */
export function keyMarkWidth(mark: MapKeyMark): number {
  return mark === 'none' ? 0 : KEY_CAPTION_SIZE * MARK_WIDTH_RATIO;
}

/**
 * Where a key will land, without drawing it.
 *
 * Lives here rather than in `MapKey.tsx` because two callers need it before anything is
 * drawn and neither of them wants a component: the label declutterer, so a name is dropped
 * rather than hidden under the plate, and `hooks/use-map-key`, which picks the corner the
 * plate covers the fewest PINS in. A pure module is also the only way either can be tested
 * without a renderer, and the pin case was a defect nobody could see in a screenshot.
 *
 * @param caption - The one line of text.
 * @param mark - Which swatch, which decides how much space is reserved before the text.
 * @param viewport - The pixel box.
 * @param corner - Which corner to sit in.
 * @param inset - How far in from the edges. Defaults to the scale bar's own margin.
 * @returns The plate, its mark and its text positions. Side effects: none.
 */
export function mapKeyPlate(
  caption: string,
  mark: MapKeyMark,
  viewport: Viewport,
  corner: MapCorner,
  inset: CornerInset = DEFAULT_KEY_INSET,
): CornerPlacement {
  return cornerPlate(caption, KEY_CAPTION_SIZE, viewport, corner, keyMarkWidth(mark), inset);
}
