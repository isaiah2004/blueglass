/**
 * A pin and its label, drawn on the map.
 *
 * Purpose
 *   `image1.png` marks each stop with a small glowing golden dot and sets the name beside
 *   it on a dark plate. This is that mark. Departures and destinations are drawn larger
 *   than the places passed through, because the route's ends are what the reader is
 *   looking for.
 *
 * Why the label carries a plate and not a text shadow
 *   `paint-order` is unsupported in `react-native-svg`, so the usual trick — a wide stroke
 *   under the fill — paints the halo *over* the glyphs and thickens them. A plate rectangle
 *   behind the text works identically on both platforms and is what the mockups draw.
 *
 * Dependencies
 *   `react-native-svg`, the label geometry, the derived palette, the typography tokens.
 */

import type { JSX } from 'react';
import { Circle, G, Rect, Text } from 'react-native-svg';

import { fontFamily, radius, uiSize } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { ScreenPoint, Viewport } from '../geo/projection';
import { mapPalette } from '../theme/map-palette';

import { placeLabel } from './map-label-geometry';

/** Inputs to {@link MapMarker}. */
export interface MapMarkerProps {
  /** Where the pin goes, already projected. */
  readonly point: ScreenPoint;
  /** The place name. */
  readonly name: string;
  /** The pixel box, so a label near an edge flips inside it. */
  readonly viewport: Viewport;
  /** True for a departure or a destination: a larger pin and a visible name. */
  readonly emphasised: boolean;
  /** False hides the name, for a stop too crowded to label. */
  readonly labelled: boolean;
}

/** Radius of an ordinary stop's pin. */
const PIN_RADIUS = 3.5;

/** Radius of a departure's or destination's pin. */
const EMPHASISED_PIN_RADIUS = 5;

/** The halo is drawn at this multiple of the pin's radius. */
const HALO_SCALE = 2.4;

/** Place labels take the smallest UI step; they are chrome over a picture, not body copy. */
const LABEL_SIZE = uiSize.xs;

/**
 * Draw one stop.
 *
 * @param props - See {@link MapMarkerProps}.
 * @returns The pin, and its label when there is room for one.
 *
 * Side effects: none.
 */
export function MapMarker({
  point,
  name,
  viewport,
  emphasised,
  labelled,
}: MapMarkerProps): JSX.Element {
  const palette = mapPalette(useTheme());
  const pinRadius = emphasised ? EMPHASISED_PIN_RADIUS : PIN_RADIUS;
  const label = placeLabel(point, name, LABEL_SIZE, viewport);

  return (
    <G testID={`spatial-marker-${name}`} accessibilityLabel={name}>
      <Circle cx={point.x} cy={point.y} r={pinRadius * HALO_SCALE} fill={palette.pinHalo} />
      <Circle cx={point.x} cy={point.y} r={pinRadius} fill={palette.pin} />
      {labelled ? (
        <>
          <Rect
            x={label.x}
            y={label.y}
            width={label.width}
            height={label.height}
            rx={radius.control}
            fill={palette.labelPlate}
          />
          <Text
            x={label.textX}
            y={label.textY}
            fill={palette.label}
            fontSize={LABEL_SIZE}
            fontFamily={fontFamily.ui.medium}
            testID={`spatial-label-${name}`}
          >
            {name}
          </Text>
        </>
      ) : null}
    </G>
  );
}
