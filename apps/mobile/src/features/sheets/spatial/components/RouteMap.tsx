/**
 * The `[Route]` map: coastline, the mention-order trace, pins, decluttered labels.
 *
 * Purpose
 *   Compose the four layers into one picture. The arithmetic — fitting the camera to the
 *   measured viewport, projecting the pins, and decluttering the labels — is
 *   `hooks/use-route-geometry`, so this file is composition only.
 *
 * What the line means
 *   Under `scheme = 'chapter'` the pins are the places the text NAMES, in the order it
 *   names them, so the line joining them is a reading order rather than a road. The sheet
 *   says so directly under its heading, above this map, and the sheet's accessible name
 *   repeats it — see `RouteSheet` and `model/route-view.ts`.
 *
 * Re-render discipline
 *   `MapSurface` and the marker layer are memoised on the transform, so the frame loop
 *   inside `RouteLine` re-renders two paths and nothing else. `DECISIONS.md` A-3.
 *
 * Dependencies
 *   The geo layer, the draw hook, the geometry hook, `MapSurface`, `RouteLine`, `MapMarker`.
 */

import type { JSX } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { uiSize } from '@/theme';
import { useIsReduceMotionEnabled, useMotion } from '@/theme/runtime';

import { drawDuration } from '../hooks/draw-progress';
import { useMapViewport } from '../hooks/use-map-viewport';
import { useRouteGeometry, type RouteMapPin } from '../hooks/use-route-geometry';

import { MapMarker } from './MapMarker';
import { MapSurface } from './MapSurface';
import { RouteLine, type RouteLineVariant } from './RouteLine';

export type { RouteMapPin } from '../hooks/use-route-geometry';
export type { RouteLineVariant } from './RouteLine';

/** Inputs to {@link RouteMap}. */
export interface RouteMapProps {
  /** The places, in the order the payload lists them. */
  readonly pins: readonly RouteMapPin[];
  /** What the map is of. Used as its accessible name and as the draw's restart key. */
  readonly title: string;
  /**
   * What the line between the pins is allowed to say. `mentionOrder` — the only value any
   * shipped payload produces today — draws a dashed connector rather than §6's route line.
   */
  readonly variant: RouteLineVariant;
  /** Extra layout — width, margins. Never colours. */
  readonly style?: StyleProp<ViewStyle> | undefined;
}

/**
 * Map shape, width over height.
 *
 * 1.55 is close to the golden rectangle and to the map panel in `image1.png`. It also keeps
 * the map under half the height of a bottom sheet on a phone, which matters: the sheet
 * covers the bottom half of the screen and the stat strip has to be visible without a
 * scroll (`design-language.md` §4).
 */
const MAP_ASPECT = 1.55;

/** How the pins are fitted into whatever box the layout gave us. */
const FIT = {
  /** Pixels kept clear around the fitted set, so an edge pin is not half-drawn. */
  padding: 28,
  /** Zoom used when every pin shares one point — no span to fit. */
  fallbackZoom: 8,
  /** Must match `MapMarker`'s, so decluttering measures what is drawn. */
  labelSize: uiSize.xs,
} as const;

/**
 * Draw the map.
 *
 * @param props - See {@link RouteMapProps}.
 * @returns The map, or an empty box on the first render before layout has measured it.
 *
 * Side effects: none beyond the draw animation's frame loop.
 */
export function RouteMap({ pins, title, variant, style }: RouteMapProps): JSX.Element {
  const { viewport, onLayout } = useMapViewport(MAP_ASPECT);
  const isReduceMotionEnabled = useIsReduceMotionEnabled();
  const tokens = useMotion();
  const geometry = useRouteGeometry(pins, viewport, FIT);

  return (
    <View style={[styles.frame, style]} onLayout={onLayout} testID="spatial-route-map">
      {viewport !== null && geometry.transform !== null ? (
        <MapSurface
          transform={geometry.transform}
          viewport={viewport}
          accessibilityLabel={`${title}, mapped`}
          testID="spatial-route-map-surface"
        >
          <RouteLine
            points={geometry.pins.map((pin) => pin.point)}
            durationMs={drawDuration(tokens.duration.slow, isReduceMotionEnabled)}
            restartKey={title}
            variant={variant}
          />
          {geometry.pins.map((pin) => (
            <MapMarker
              key={pin.key}
              point={pin.point}
              name={pin.name}
              viewport={viewport}
              emphasised={pin.emphasised}
              labelled={geometry.labelled.has(pin.key)}
            />
          ))}
        </MapSurface>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: MAP_ASPECT, width: '100%' },
});
