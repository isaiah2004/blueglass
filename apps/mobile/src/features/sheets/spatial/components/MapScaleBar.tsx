/**
 * The scale bar drawn in the corner of a map.
 *
 * Purpose
 *   A map with no scale is a picture rather than a measurement, and the 3D City sheet's
 *   whole claim is that a place is *here, to this precision*. The bar is also the honest
 *   depth cue that replaces the reconstruction `Q-008` says we cannot have: it tells the
 *   reader how big the view is without pretending to show them the city.
 *
 * Why it is a hairline rule and not a bar
 *   It was a 3 pt solid slab painted in `ink.primary` with `ink.primary` type stacked over
 *   it — the only 100 %-white element on an otherwise restrained dark canvas, sitting
 *   directly on the coastline it was measuring. It read as a rendering artefact rather than
 *   as an annotation. `D-05` asks for restraint plus texture, so the bar now draws the way
 *   the rest of the map furniture does: a hairline rule with two end ticks, a caption in
 *   the metadata tone, and a plate underneath so it stays legible over land without
 *   painting over it.
 *
 * Dependencies
 *   `react-native-svg`, `../geo/scale-bar` for the arithmetic, the derived palette.
 */

import type { JSX } from 'react';
import { G, Line, Rect, Text } from 'react-native-svg';

import { borderWidth, fontFamily, metadataSize, radius, spacing } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { MapTransform, Viewport } from '../geo/projection';
import { scaleBar } from '../geo/scale-bar';
import { mapPalette } from '../theme/map-palette';

/** Inputs to {@link MapScaleBar}. */
export interface MapScaleBarProps {
  /** The map's current transform. */
  readonly transform: MapTransform;
  /** The pixel box, so the bar can sit in the bottom-left corner of it. */
  readonly viewport: Viewport;
  /** The latitude the bar is measured at. Mercator's scale varies with it. */
  readonly latitude: number;
}

/** Longest bar the layout allows, as a fraction of the map's width. */
const MAX_BAR_FRACTION = 0.34;

/** How far the two end ticks rise above the rule. */
const TICK_HEIGHT = spacing.sm;

/** What {@link ScaleRule} draws. */
interface ScaleRuleProps {
  readonly left: number;
  readonly baseline: number;
  readonly width: number;
  readonly stroke: string;
}

/**
 * Draw the scale bar.
 *
 * @param props - See {@link MapScaleBarProps}.
 * @returns The bar and its caption, or nothing when no round distance is legible at this
 *   zoom. Side effects: none.
 */
export function MapScaleBar({
  transform,
  viewport,
  latitude,
}: MapScaleBarProps): JSX.Element | null {
  const palette = mapPalette(useTheme());
  const bar = scaleBar(transform, latitude, viewport.width * MAX_BAR_FRACTION);
  if (bar === null) return null;

  const left = spacing.md;
  const baseline = viewport.height - spacing.md;
  const capTop = baseline - TICK_HEIGHT - metadataSize.xs;

  return (
    <G testID="spatial-scale-bar" accessibilityLabel={`Scale bar, ${bar.label}`}>
      {/* The plate keeps the rule legible over a coastline without covering it. */}
      <Rect
        x={left - spacing.xs}
        y={capTop - spacing.xs}
        width={bar.widthPx + spacing.sm}
        height={baseline - capTop + spacing.sm}
        rx={radius.control}
        fill={palette.labelPlate}
      />
      <ScaleRule left={left} baseline={baseline} width={bar.widthPx} stroke={palette.furniture} />
      <Text
        x={left}
        y={baseline - TICK_HEIGHT - spacing.xs}
        fill={palette.furnitureLabel}
        fontSize={metadataSize.xs}
        fontFamily={fontFamily.metadata.medium}
      >
        {bar.label}
      </Text>
    </G>
  );
}

/**
 * The rule and its two end ticks.
 *
 * @param props - See {@link ScaleRuleProps}.
 * @returns Three hairlines. Side effects: none.
 */
function ScaleRule({ left, baseline, width, stroke }: ScaleRuleProps): JSX.Element {
  const right = left + width;
  return (
    <>
      <Line x1={left} y1={baseline} x2={right} y2={baseline} {...strokeProps(stroke)} />
      <Line
        x1={left}
        y1={baseline}
        x2={left}
        y2={baseline - TICK_HEIGHT}
        {...strokeProps(stroke)}
      />
      <Line
        x1={right}
        y1={baseline}
        x2={right}
        y2={baseline - TICK_HEIGHT}
        {...strokeProps(stroke)}
      />
    </>
  );
}

/** The one stroke every part of the rule shares. */
function strokeProps(stroke: string): { readonly stroke: string; readonly strokeWidth: number } {
  return { stroke, strokeWidth: borderWidth.hairline };
}
