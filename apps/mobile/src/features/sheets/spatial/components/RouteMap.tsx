/**
 * The `[Route]` map: coastline, pins, decluttered labels, and a line only where one is due.
 *
 * Purpose
 *   Compose the layers into one picture. The arithmetic — fitting the camera to the
 *   measured viewport, projecting the pins, and decluttering the labels — is
 *   `hooks/use-route-geometry`, so this file is composition only.
 *
 * Where the key goes, and why the pins are drawn after it
 *   `hooks/use-map-key` puts the plate in whichever bottom corner hides the fewest pins,
 *   and the key is then drawn UNDERNEATH the pin layer. Both halves were needed: the plate
 *   was reserved against the LABEL declutterer but not against the pins, so at tablet width
 *   the Jerusalem dot was drawn under it and a place the sheet counts, lists and cites had
 *   no mark on the map. A count of sixteen over fifteen visible dots is a small lie of
 *   exactly the kind a reader checks.
 *
 * The one decision this file makes
 *   Whether a line is drawn between the pins at all. A line between two pins asserts that
 *   somebody travelled from one to the other, and under `scheme = 'chapter'` the pins are
 *   only the places the text NAMES, in the order it names them — Acts 16 names Jerusalem,
 *   where Paul does not go, and Bithynia, which he is not permitted to enter. So under
 *   `mentionOrder` there is no line: the places are points, and `MapKey` says on the
 *   drawing what the points are. Under `route` — a scheme that can establish travel, which
 *   no shipped payload uses yet — `RouteLine` draws §6's glowing progressive line and the
 *   key names it as a journey. The two maps are then unmistakably different pictures, which
 *   is the only way a reader can tell which claim they are looking at.
 *
 * Re-render discipline
 *   `MapSurface` and the pin layer are memoised on the transform, so the frame loop inside
 *   `RouteLine` re-renders two paths and nothing else. `DECISIONS.md` A-3.
 *
 * Dependencies
 *   The geo layer, the draw hook, the geometry hook, `MapSurface`, `RouteLine`, `MapMarker`,
 *   `MapKey`.
 */

import type { JSX } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { uiSize } from '@/theme';
import { useIsReduceMotionEnabled, useMotion } from '@/theme/runtime';

import type { Viewport } from '../geo/projection';
import { drawDuration } from '../hooks/draw-progress';
import { useMapKey } from '../hooks/use-map-key';
import { useMapViewport } from '../hooks/use-map-viewport';
import {
  useRouteGeometry,
  type RouteGeometry,
  type RouteMapPin,
} from '../hooks/use-route-geometry';

import { MapKey } from './MapKey';
import { MapMarker } from './MapMarker';
import { MapSurface } from './MapSurface';
import { RouteLine } from './RouteLine';

export type { RouteMapPin } from '../hooks/use-route-geometry';

/** What the map is allowed to say about the order of its pins. */
export type RouteLineVariant = 'route' | 'mentionOrder';

/** Inputs to {@link RouteMap}. */
export interface RouteMapProps {
  /** The places, in the order the payload lists them. */
  readonly pins: readonly RouteMapPin[];
  /** What the map is of. Used as its accessible name and as the draw's restart key. */
  readonly title: string;
  /**
   * What the map is allowed to say. `mentionOrder` — the only value any shipped payload
   * produces today — draws the places as points with no line between them. `route` draws
   * §6's line, and is for a scheme that can establish an ordered journey.
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

/**
 * What the key says about the marks, per variant.
 *
 * The mention-order wording names the absence rather than leaving it to be noticed: a
 * reader who has seen route maps elsewhere reads a missing line as a missing layer unless
 * something says otherwise, and "not a journey" is the whole finding in three words.
 */
const KEY_CAPTION: Readonly<Record<RouteLineVariant, string>> = {
  mentionOrder: 'Places named, not a journey',
  route: 'Attested journey',
};

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
  const isJourney = variant === 'route';
  const caption = KEY_CAPTION[variant];
  const mark = isJourney ? 'journey' : 'place';
  // Two passes, and the first one is what stops the key covering a mark the sheet counts.
  // The projection does not depend on the key, so `placed` is the same pins either way;
  // only the LABELS depend on what the key reserves, which is why the second pass exists.
  const placed = useRouteGeometry(pins, viewport, FIT);
  const key = useMapKey(
    placed.pins.map((pin) => pin.point),
    viewport,
    caption,
    mark,
  );
  const geometry = useRouteGeometry(pins, viewport, FIT, key.reserved);

  return (
    <View style={[styles.frame, style]} onLayout={onLayout} testID="spatial-route-map">
      {viewport === null || geometry.transform === null ? null : (
        <MapSurface
          transform={geometry.transform}
          viewport={viewport}
          accessibilityLabel={`${title}, mapped`}
          testID="spatial-route-map-surface"
        >
          {isJourney ? (
            <RouteLine
              points={geometry.pins.map((pin) => pin.point)}
              durationMs={drawDuration(tokens.duration.slow, isReduceMotionEnabled)}
              restartKey={title}
            />
          ) : null}
          <MapKey
            viewport={viewport}
            caption={caption}
            mark={mark}
            corner={key.corner}
            testID="spatial-route-key"
          />
          <PinLayer geometry={geometry} viewport={viewport} />
        </MapSurface>
      )}
    </View>
  );
}

/**
 * Every pin, with the names the declutterer kept.
 *
 * Split out at the seam rule 5.4.3 forces. It is also the layer the honesty rule lives in:
 * a pin is drawn for every place the passage names, whether or not there was room for its
 * label, so nothing is silently dropped from the picture.
 *
 * @param props.geometry - The projected pins and the labelled set.
 * @param props.viewport - The pixel box, so a label near an edge flips inside it.
 * @returns One marker per pin. Side effects: none.
 */
function PinLayer({
  geometry,
  viewport,
}: {
  readonly geometry: RouteGeometry;
  readonly viewport: Viewport;
}): JSX.Element {
  return (
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: MAP_ASPECT, width: '100%' },
});
