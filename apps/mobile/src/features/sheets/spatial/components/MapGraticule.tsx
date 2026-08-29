/**
 * The coordinate grid drawn under the coastline.
 *
 * Purpose
 *   `geo/graticule.ts` explains why the grid exists at all: it makes a coordinate claim
 *   visible, and it stops an inland site — Lystra, Iconium, Derbe — projecting onto an
 *   empty rectangle that reads as a failed render. This component is only the drawing of
 *   it: faint lines, and a label on the first meridian and the first parallel.
 *
 * Why usually only two labels
 *   Labelling every line turns the map into a chart. One of each is enough to establish
 *   what the spacing means, and the sheet prints the site's exact coordinates in text
 *   underneath.
 *
 * When every line is labelled instead
 *   Babylon, Nineveh and Susa are measurably landlocked: `geo/map-framing.ts` cannot find
 *   a zoom down to its floor that puts a readable share of water in frame, so those maps
 *   open on a field of land with no coast to read a position from. The grid is then the
 *   only geography on the map, and a grid a reader cannot read a value off is decoration.
 *   `labels="all"` is that case, and only that case.
 *
 * Why it is several functions
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

/** How much of the grid carries a label. */
export type GraticuleLabelling = 'edges' | 'all';

/** Inputs to {@link MapGraticule}. */
export interface MapGraticuleProps {
  /** The map's current transform. */
  readonly transform: MapTransform;
  /** The pixel box. */
  readonly viewport: Viewport;
  /**
   * `edges` (the default) labels the first meridian and the first parallel. `all` labels
   * every line, for a frame with no coastline to orient by. See the module header.
   */
  readonly labels?: GraticuleLabelling;
}

/**
 * How far down the map a parallel must be before its label clears the meridians' own row.
 *
 * A meridian label's glyph box ends at `metadataSize.xs + spacing.xs`; a parallel's begins
 * at `position - spacing.xs - metadataSize.xs`. Twice the sum is the first position where
 * the two do not touch. Without it, `labels="all"` printed "55 E" over "40 N" at Babylon.
 */
const LABEL_BAND = 2 * (metadataSize.xs + spacing.xs);

/** What both sub-drawings need. */
interface GridProps {
  readonly meridians: readonly GraticuleLine[];
  readonly parallels: readonly GraticuleLine[];
  readonly viewport: Viewport;
  readonly stroke: string;
}

/** What one drawn label needs. */
interface GridLabelProps {
  readonly line: GraticuleLine;
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
export function MapGraticule({
  transform,
  viewport,
  labels = 'edges',
}: MapGraticuleProps): JSX.Element | null {
  const palette = mapPalette(useTheme());
  const grid = graticule(transform, viewport);
  if (grid.meridians.length === 0 && grid.parallels.length === 0) return null;
  // A parallel whose label would land in the meridians' own strip prints one value on top
  // of another, which `labels="all"` made visible at Babylon: "55 E" over "40 N".
  const clear = grid.parallels.filter((line) => line.position > LABEL_BAND);
  const shown =
    labels === 'all'
      ? { meridians: grid.meridians, parallels: clear }
      : { meridians: grid.meridians.slice(0, 1), parallels: clear.slice(0, 1) };

  return (
    <G testID="spatial-graticule" aria-hidden>
      <GridLines
        meridians={grid.meridians}
        parallels={grid.parallels}
        viewport={viewport}
        stroke={palette.graticule}
      />
      <GridLabels
        meridians={shown.meridians}
        parallels={shown.parallels}
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
 * The labels for whichever lines the caller chose.
 *
 * @param props - See {@link GridProps}. The lists are already narrowed to what is drawn.
 * @returns One `<Text>` per meridian and per parallel given. Side effects: none.
 */
function GridLabels({ meridians, parallels, viewport, stroke }: GridProps): JSX.Element {
  return (
    <>
      {meridians.map((line) => (
        <MeridianLabel
          key={`meridian-${line.label}`}
          line={line}
          viewport={viewport}
          stroke={stroke}
        />
      ))}
      {parallels.map((line) => (
        <ParallelLabel
          key={`parallel-${line.label}`}
          line={line}
          viewport={viewport}
          stroke={stroke}
        />
      ))}
    </>
  );
}

/**
 * One meridian's label, set just inside the top of the map.
 *
 * @param props - See {@link GridLabelProps}.
 * @returns The label. Side effects: none.
 */
function MeridianLabel({ line, stroke }: GridLabelProps): JSX.Element {
  return (
    <Text
      x={line.position + spacing.xs}
      y={metadataSize.xs + spacing.xs}
      fill={stroke}
      fontSize={metadataSize.xs}
      fontFamily={fontFamily.metadata.medium}
    >
      {line.label}
    </Text>
  );
}

/**
 * One parallel's label, set just inside the right edge of the map.
 *
 * @param props - See {@link GridLabelProps}.
 * @returns The label. Side effects: none.
 */
function ParallelLabel({ line, viewport, stroke }: GridLabelProps): JSX.Element {
  return (
    <Text
      x={viewport.width - spacing.md}
      y={line.position - spacing.xs}
      fill={stroke}
      fontSize={metadataSize.xs}
      fontFamily={fontFamily.metadata.medium}
      textAnchor="end"
    >
      {line.label}
    </Text>
  );
}
