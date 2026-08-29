/**
 * Public API of the spatial sheets — `[Route]` and `[3D City]`.
 *
 * Purpose
 *   One import surface for the badge sheet host. Nothing outside this feature reaches into
 *   its subdirectories (rule 5.3.3), so the map internals — the projection, the vendored
 *   coastline, the declutter rule — can change without a single import moving.
 *
 * What a host renders
 *   ```tsx
 *   import { SpatialSheet } from '@/features/sheets/spatial';
 *
 *   <SpatialSheet badge={{ payload: badge.payload, sources: badge.sources }} />
 *   ```
 *   The host supplies the container: a bottom sheet below 600 dp, the context rail at and
 *   above it (`design-language.md` §4, `Q-006`). This feature never renders a `Modal`.
 *
 * What is deliberately not exported
 *   `MapSurface`, `RouteLine`, `MapMarker`, `MapScaleBar` and the geo layer. They are the
 *   map's internals; a caller that wanted them would be building a second map, and should
 *   say so rather than reach in.
 *
 *   `testing/fixtures.ts` is also unexported — it is real API output kept for tests, and a
 *   fixture reachable from shipped code is a content source waiting to happen.
 */

export { SpatialSheet } from './components/SpatialSheet';
export type { SpatialBadge, SpatialSheetProps } from './components/SpatialSheet';

// The two sheets, for a host that has already narrowed the union itself.
export { RouteSheet } from './components/RouteSheet';
export type { RouteSheetProps } from './components/RouteSheet';
export { CitySiteSheet } from './components/CitySiteSheet';
export type { CitySiteSheetProps } from './components/CitySiteSheet';

// The maps, for the Discover tab's own route card (`image5.png`), which shows a route with
// no sheet around it.
export { RouteMap } from './components/RouteMap';
export type { RouteLineVariant, RouteMapPin, RouteMapProps } from './components/RouteMap';
export { CitySiteMap } from './components/CitySiteMap';
export type { CitySiteMapProps } from './components/CitySiteMap';

// The payload shapes the API sends, and the delta from `packages/shared`.
export type {
  CitySheetPayload,
  PassageKeys,
  RouteSheetPayload,
  SheetChrome,
  SpatialLocation,
  SpatialSheetSources,
} from './model/spatial-payload.types';

// The view models, for a caller that wants the derived figures without the chrome.
export { toRouteView } from './model/route-view';
export type { RoutePlace, RouteStat, RouteView } from './model/route-view';
export { toCityView } from './model/city-view';
export type { CityStat, CityView } from './model/city-view';

// `AI-05`, so a host can decide not to draw the badge's inline pill either.
export { attributionLines, canRenderBadge } from './model/attribution';
export type { AttributionLine } from './model/attribution';

// The seam a commissioned 3D city model drops into. `Q-008`: none exists today.
export { NO_RECONSTRUCTIONS, resolveReconstruction } from './model/reconstruction';
export type {
  CityReconstruction,
  CityReconstructionProps,
  CityReconstructionRegistry,
} from './model/reconstruction';
