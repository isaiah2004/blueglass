/**
 * The one line of text a map is allowed to say about itself.
 *
 * Purpose
 *   Two of the three reported defects were the map asserting something the data does not
 *   support, and in both cases the correcting sentence existed — in the sheet, above the
 *   map, where a reader who has already looked at the picture has already formed the wrong
 *   idea. A map that is cropped into a rail, screenshotted, or simply looked at before it
 *   is read around carries none of that sentence with it. This component puts it *on* the
 *   drawing.
 *
 * Its two jobs today
 *   - `[Route]` labels its own marks: gold dots are places the chapter names, and under
 *     `routes.scheme = 'chapter'` no line joins them because none is attested. The key is
 *     what tells the reader that the absence is a statement rather than a missing layer.
 *   - `[Site]` says when a frame holds no coastline at all — Babylon, Nineveh and Susa are
 *     measurably landlocked at every zoom `geo/map-framing.ts` will open. An unexplained
 *     field of one colour is the exact impression the report described as a rendering bug.
 *
 * Why it draws inside the SVG rather than beside it
 *   The scale bar established the pattern and the reason: an annotation that measures the
 *   picture belongs in the picture. It is also the only way the note survives the map being
 *   used on its own — `index.ts` exports `RouteMap` for the Discover tab's route card,
 *   which has no sheet copy around it at all.
 *
 * Dependencies
 *   `react-native-svg`, `./map-label-geometry`, the derived palette, the typography tokens.
 */

import type { JSX } from 'react';
import { Circle, G, Line, Rect, Text } from 'react-native-svg';

import { fontFamily, radius } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { Viewport } from '../geo/projection';
import { mapPalette } from '../theme/map-palette';

import {
  DEFAULT_KEY_INSET,
  KEY_CAPTION_SIZE,
  keyMarkWidth,
  mapKeyPlate,
  type CornerInset,
  type MapCorner,
  type MapKeyMark,
} from './map-label-geometry';

export { mapKeyPlate } from './map-label-geometry';
export type { MapKeyMark } from './map-label-geometry';

/** Inputs to {@link MapKey}. */
export interface MapKeyProps {
  /** The pixel box, so the key can sit in a corner of it. */
  readonly viewport: Viewport;
  /** The one line of text. */
  readonly caption: string;
  /** What the swatch shows, or `none` for a note about the map rather than its marks. */
  readonly mark: MapKeyMark;
  /** Which corner to sit in. */
  readonly corner: MapCorner;
  /**
   * How far in from the edges. Defaults to the same margin the scale bar uses; pass a
   * larger `y` to stack this key above something already in that corner.
   */
  readonly inset?: CornerInset;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/** Radius of the `place` swatch. Matches an unemphasised pin in `MapMarker`. */
const PLACE_MARK_RADIUS = 3.5;

/** Stroke width of the `journey` swatch. Matches the route line in `RouteLine`. */
const JOURNEY_MARK_WIDTH = 2.5;

/**
 * Draw the key.
 *
 * @param props - See {@link MapKeyProps}.
 * @returns A plate, its swatch and its caption.
 *
 * Side effects: none. Nothing here animates.
 */
export function MapKey({
  viewport,
  caption,
  mark,
  corner,
  inset = DEFAULT_KEY_INSET,
  testID,
}: MapKeyProps): JSX.Element {
  const palette = mapPalette(useTheme());
  const markWidth = keyMarkWidth(mark);
  const plate = mapKeyPlate(caption, mark, viewport, corner, inset);

  return (
    <G testID={testID ?? 'spatial-map-key'} accessibilityLabel={caption} accessibilityRole="text">
      <Rect
        x={plate.x}
        y={plate.y}
        width={plate.width}
        height={plate.height}
        rx={radius.control}
        fill={palette.keyPlate}
      />
      <KeyMark mark={mark} x={plate.markX} y={plate.markY} width={markWidth} palette={palette} />
      <Text
        x={plate.textX}
        y={plate.textY}
        fill={palette.furnitureLabel}
        fontSize={KEY_CAPTION_SIZE}
        fontFamily={fontFamily.ui.medium}
      >
        {caption}
      </Text>
    </G>
  );
}

/**
 * The swatch, drawn exactly as the thing it stands for is drawn.
 *
 * @param props.mark - Which swatch.
 * @param props.x - Its horizontal centre.
 * @param props.y - Its vertical centre.
 * @param props.width - The space reserved for it.
 * @param props.palette - The derived map palette.
 * @returns The swatch, or nothing for a note that stands for no mark. Side effects: none.
 */
function KeyMark({
  mark,
  x,
  y,
  width,
  palette,
}: {
  readonly mark: MapKeyMark;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly palette: ReturnType<typeof mapPalette>;
}): JSX.Element | null {
  if (mark === 'none') return null;
  if (mark === 'place') {
    return <Circle cx={x} cy={y} r={PLACE_MARK_RADIUS} fill={palette.pin} />;
  }
  return (
    <Line
      x1={x - width / 2}
      y1={y}
      x2={x + width / 2}
      y2={y}
      stroke={palette.route}
      strokeWidth={JOURNEY_MARK_WIDTH}
      strokeLinecap="round"
    />
  );
}
