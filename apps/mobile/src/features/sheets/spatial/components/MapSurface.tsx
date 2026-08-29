/**
 * The drawn map: sea, coastline, and whatever the caller lays over them.
 *
 * Purpose
 *   Decision `M-01` — a custom stylised map from GeoJSON, **no tile provider and no Mapbox
 *   token**. This is the whole of the basemap: a gradient rectangle for the sea, one path
 *   for every coastline in view, and a slot for the route and its pins. Nothing here
 *   fetches anything, so a spatial sheet works with the network off.
 *
 * Node count, which is the reason this is `react-native-svg` and not a canvas
 *   The 127 land and lake rings are concatenated into ONE path drawn with
 *   `fillRule="evenodd"`, so lakes and polygon holes subtract themselves. The basemap is
 *   therefore two nodes — a rect and a path — regardless of how far the reader zooms. See
 *   `README.md` §2 for the measurement and the comparison with Skia.
 *
 * Why the glow is a stroke and not a filter
 *   `react-native-svg` does not implement `feGaussianBlur` on Android, and re-blurring
 *   under an animating stroke is the per-frame cost `flutter-port-map.md` §7.6 records.
 *   `RouteLine` draws a wide translucent stroke instead; this component never blurs.
 *
 * Dependencies
 *   `react-native-svg`, the geo layer, and the derived map palette. No data fetching.
 */

import { useMemo, type JSX, type ReactNode } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { borderWidth } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { basemap, ringsToPath } from '../geo/basemap';
import type { MapTransform, Viewport } from '../geo/projection';
import { mapPalette } from '../theme/map-palette';

import { MapGraticule } from './MapGraticule';

/** Inputs to {@link MapSurface}. */
export interface MapSurfaceProps {
  /** Where the map currently sits. */
  readonly transform: MapTransform;
  /** The pixel box being drawn into. */
  readonly viewport: Viewport;
  /** The route, pins and labels drawn over the basemap. */
  readonly children?: ReactNode;
  /** Announced by a screen reader in place of the vectors. */
  readonly accessibilityLabel: string;
  /** Test hook. */
  readonly testID?: string;
}

/** Gradient id. Unique per component, not per instance: two maps may share one gradient. */
const SEA_GRADIENT_ID = 'atlas-spatial-sea';

/**
 * Draw the basemap.
 *
 * @param props - See {@link MapSurfaceProps}.
 * @returns The SVG surface.
 *
 * Side effects: none. The coastline path is memoised on the transform and viewport, so a
 * re-render caused by the route's draw animation does not re-project 3,327 points.
 */
export function MapSurface({
  transform,
  viewport,
  children,
  accessibilityLabel,
  testID,
}: MapSurfaceProps): JSX.Element {
  const palette = mapPalette(useTheme());

  const coastline = useMemo(
    () => ringsToPath([...basemap.land, ...basemap.lakes], transform, viewport),
    [transform, viewport],
  );

  return (
    <Svg
      width={viewport.width}
      height={viewport.height}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      {...(testID === undefined ? {} : { testID })}
    >
      <Defs>
        <LinearGradient id={SEA_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.seaTop} />
          <Stop offset="1" stopColor={palette.seaBottom} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${SEA_GRADIENT_ID})`} />
      <MapGraticule transform={transform} viewport={viewport} />
      <Path
        d={coastline}
        fill={palette.land}
        fillRule="evenodd"
        stroke={palette.coast}
        strokeWidth={borderWidth.hairline}
        strokeLinejoin="round"
        testID="spatial-map-coastline"
      />
      {children}
    </Svg>
  );
}
