/**
 * The `[3D City]` map: one site, close up, with a scale.
 *
 * Purpose
 *   `Q-008` is a confirmed negative — no openly-licensed 3D reconstruction of a biblical
 *   city exists, and the nearest candidate is CC BY-NC-ND, which fails twice over. So this
 *   is not a reconstruction and does not pretend to be one. It is a **site map**: the
 *   coastline around the place, the pin, its name, and a scale bar that says how big the
 *   view is. Everything on it comes from the gazetteer.
 *
 * Why the camera comes from a zoom and not from a fit
 *   A single pin has no bounding box, so there is nothing to fit — `fitTransform` would
 *   fall back to a zoom anyway. This component asks for the zoom directly, which makes the
 *   framing a stated decision rather than a fallback, and lets a settlement and a region be
 *   framed differently.
 *
 * The preferred zoom is a starting point, not the answer
 *   Zoom is degrees per *pixel*, so one constant frames three different amounts of world
 *   across a 375 dp phone sheet, a 290 dp rail and a 560 dp wide rail. An inland site such
 *   as Lystra came out as an empty graticule with a single pin — a grey blob a reader
 *   reasonably reads as a broken map. `geo/site-framing.ts` steps the camera out until the
 *   vendored coastline is genuinely in frame, so a coastal site keeps the close framing it
 *   already had and an inland one widens exactly as far as it must.
 *
 * Where a real model would go
 *   `model/reconstruction.ts` is the seam. When a model is commissioned, `CitySiteSheet`
 *   renders it above this map; this component does not change.
 *
 * Dependencies
 *   The geo layer, `MapSurface`, `MapMarker`, `MapScaleBar`.
 */

import { useMemo, type JSX } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { project, transformForZoom, type GeoPoint } from '../geo/projection';
import { siteZoom } from '../geo/site-framing';
import { useMapViewport } from '../hooks/use-map-viewport';

import { MapMarker } from './MapMarker';
import { MapScaleBar } from './MapScaleBar';
import { MapSurface } from './MapSurface';

/** Inputs to {@link CitySiteMap}. */
export interface CitySiteMapProps {
  /** `[longitude, latitude]` of the site. */
  readonly coordinates: GeoPoint;
  /** The place name, drawn beside the pin. */
  readonly name: string;
  /** The gazetteer's feature type. A region is framed wider than a settlement. */
  readonly featureType: string;
  /** Extra layout. Never colours. */
  readonly style?: StyleProp<ViewStyle> | undefined;
}

/** Map shape, width over height. Squarer than the route map: one pin, not a journey. */
const MAP_ASPECT = 1.35;

/**
 * Preferred zoom for a point-like site.
 *
 * This is a **locator** map, and the zoom was chosen by looking rather than by taste. At
 * 8.4 (~60 miles across a 340 dp sheet) an inland site has no coastline in the frame at all
 * and the map reads as a failed render; at 7.2 it still does. 6.2 puts roughly 210 miles
 * across a phone sheet, which is close enough for the pin to mean a place. It is now a
 * *preference*: `siteZoom` widens it when this particular viewport still has no coast in it.
 */
const SITE_ZOOM = 6.2;

/** Zoom for a region, whose pin marks somewhere inside an area rather than a point. */
const REGION_ZOOM = 5;

/** Feature types the gazetteer uses for something larger than a point. */
const WIDE_FEATURES: ReadonlySet<string> = new Set(['region', 'river', 'water', 'terrain']);

/**
 * Draw the site map.
 *
 * @param props - See {@link CitySiteMapProps}.
 * @returns The map, or an empty box on the render before layout has measured it.
 *
 * Side effects: none. Nothing here animates.
 */
export function CitySiteMap({
  coordinates,
  name,
  featureType,
  style,
}: CitySiteMapProps): JSX.Element {
  const { viewport, onLayout } = useMapViewport(MAP_ASPECT);
  const preferredZoom = WIDE_FEATURES.has(featureType) ? REGION_ZOOM : SITE_ZOOM;

  const transform = useMemo(() => {
    if (viewport === null) return null;
    return transformForZoom(coordinates, siteZoom(coordinates, viewport, preferredZoom), viewport);
  }, [coordinates, preferredZoom, viewport]);

  return (
    <View style={[styles.frame, style]} onLayout={onLayout} testID="spatial-city-map">
      {viewport !== null && transform !== null ? (
        <MapSurface
          transform={transform}
          viewport={viewport}
          accessibilityLabel={`Map of ${name}`}
          testID="spatial-city-map-surface"
        >
          <MapMarker
            point={project(transform, coordinates)}
            name={name}
            viewport={viewport}
            emphasised
            labelled
          />
          <MapScaleBar transform={transform} viewport={viewport} latitude={coordinates[1]} />
        </MapSurface>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: MAP_ASPECT, width: '100%' },
});
