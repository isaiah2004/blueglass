/**
 * The coordinate grid drawn under the coastline.
 *
 * Purpose
 *   `geo/graticule.ts` explains why the grid exists at all: it makes a coordinate claim
 *   visible, and it stops an inland site — Lystra, Iconium, Derbe — projecting onto an
 *   empty rectangle that reads as a failed render. This component is only the drawing of
 *   it: faint lines, and a label on the first meridian and the first parallel.
 *
 * Why only two labels
 *   Labelling every line turns the map into a chart. One of each is enough to establish
 *   what the spacing means, and the sheet prints the site's exact coordinates in text
 *   underneath.
 *
 * Why it is three functions
 *   Rule 5.4.3 caps a function at fifty lines. The lines and the labels are two independent
 *   drawings over the same grid, so they split along that seam rather than at an arbitrary
 *   point.
 *
 * Dependencies
 *   `react-native-svg`, `../geo/graticule`, the derived palette.
 */

import type { JSX } from 'react';
import { G, Line, Text } from 'react-native-svg';

import { borderWidth, fontFamily, metadataSize, spacing } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { graticule, type GraticuleLine } from '../geo/graticule';
import type { MapTransform, Viewport } from '../geo/projection';
import { mapPalette } from '../theme/map-palette';

/** Inputs to {@link MapGraticule}. */
export interface MapGraticuleProps {
  /** The map's current transform. */
  readonly transform: MapTransform;
  /** The pixel box. */
  readonly viewport: Viewport;
}

/** What both sub-drawings need. */
interface GridProps {
  readonly meridians: readonly GraticuleLine[];
  readonly parallels: readonly GraticuleLine[];
  readonly viewport: Viewport;
  readonly stroke: string;
}

/**
 * Draw the grid.
 *
 * @param props - See {@link MapGraticuleProps}.
 * @returns The lines and their two labels, or nothing when no round spacing fits.
 *
 * Side effects: none.
 */
export function MapGraticule({ transform, viewport }: MapGraticuleProps): JSX.Element | null {
  const palette = mapPalette(useTheme());
  const grid = graticule(transform, viewport);
  if (grid.meridians.length === 0 && grid.parallels.length === 0) return null;

  return (
    <G testID="spatial-graticule" aria-hidden>
      <GridLines
        meridians={grid.meridians}
        parallels={grid.parallels}
        viewport={viewport}
        stroke={palette.graticule}
      />
      <GridLabels
        meridians={grid.meridians}
        parallels={grid.parallels}
        viewport={viewport}
        stroke={palette.graticuleLabel}
      />
    </G>
  );
}

/**
 * The lines themselves.
 *
 * @param props - See {@link GridProps}.
 * @returns One `<Line>` per meridian and per parallel. Side effects: none.
 */
function GridLines({ meridians, parallels, viewport, stroke }: GridProps): JSX.Element {
  return (
    <>
      {meridians.map((line) => (
        <Line
          key={`meridian-${line.label}`}
          x1={line.position}
          y1={0}
          x2={line.position}
          y2={viewport.height}
          stroke={stroke}
          strokeWidth={borderWidth.hairline}
        />
      ))}
      {parallels.map((line) => (
        <Line
          key={`parallel-${line.label}`}
          x1={0}
          y1={line.position}
          x2={viewport.width}
          y2={line.position}
          stroke={stroke}
          strokeWidth={borderWidth.hairline}
        />
      ))}
    </>
  );
}

/**
 * The one label on the first meridian and the one on the first parallel.
 *
 * @param props - See {@link GridProps}.
 * @returns Up to two `<Text>` nodes. Side effects: none.
 */
function GridLabels({ meridians, parallels, viewport, stroke }: GridProps): JSX.Element {
  const firstMeridian = meridians[0];
  const firstParallel = parallels[0];

  return (
    <>
      {firstMeridian === undefined ? null : (
        <Text
          x={firstMeridian.position + spacing.xs}
          y={metadataSize.xs + spacing.xs}
          fill={stroke}
          fontSize={metadataSize.xs}
          fontFamily={fontFamily.metadata.medium}
        >
          {firstMeridian.label}
        </Text>
      )}
      {firstParallel === undefined ? null : (
        <Text
          x={viewport.width - spacing.md}
          y={firstParallel.position - spacing.xs}
          fill={stroke}
          fontSize={metadataSize.xs}
          fontFamily={fontFamily.metadata.medium}
          textAnchor="end"
        >
          {firstParallel.label}
        </Text>
      )}
    </>
  );
}
