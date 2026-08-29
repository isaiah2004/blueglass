/**
 * Route: /spike/spatial-sheets — the spatial badge sheets, in a browser.
 *
 * Purpose
 *   Gives `[Route]` and `[3D City]` a real URL so they can be opened at every breakpoint,
 *   in both themes, and by a future Playwright spec — before the reader host that will
 *   eventually mount them exists. A drawn map (`M-01`: no tile provider, no Mapbox token)
 *   is the one thing in the app a test assertion cannot judge; it has to be looked at. The
 *   screen itself is `@/features/sheets/spatial/gallery/SpatialSheetGallery`; this file is
 *   only the router entry, so the diagnostic can be removed by deleting one file and one
 *   folder.
 *
 * Lifetime
 *   Delete this route once the reader opens these sheets from real badges and the
 *   walkthrough covers them. It is deliberately not linked from any tab (pillar 1: nothing
 *   clutters the reading canvas), which is the same contract `/spike/badges` and
 *   `/spike/textual-sheets` run under.
 */

import type { JSX } from 'react';

import { SpatialSheetGallery } from '@/features/sheets/spatial/gallery/SpatialSheetGallery';

/**
 * Render the gallery.
 *
 * @returns The diagnostic screen.
 */
export default function SpatialSheetsRoute(): JSX.Element {
  return <SpatialSheetGallery />;
}
