/**
 * The seam a commissioned 3D city model drops into, and the reason it is empty.
 *
 * Purpose
 *   Decision `Q-008` and `dataset-validation.md` §4.3 record a confirmed negative: **no
 *   openly-licensed 3D reconstruction of any biblical city exists.** The closest candidate
 *   is CC BY-NC-ND, which fails the commercial test and fails again on NoDerivatives. So
 *   M2 ships an honest 2.5D site sheet, and `City3dPayload.has_reconstruction` is `false`
 *   on every row the server can produce.
 *
 * Why the seam exists anyway
 *   That flag is worthless as documentation and valuable as an interface. This module is
 *   the interface: a registry the sheet consults, a props contract a future renderer must
 *   satisfy, and an attribution requirement it cannot skip. When a model is commissioned,
 *   the work is to implement {@link CityReconstructionRegistry} and pass it in — the sheet
 *   itself does not change, and `CitySiteSheet` already branches on the result.
 *
 * The rule the seam enforces
 *   A reconstruction carries a `SourceAttribution` like any other claim. A 3D model is an
 *   interpretation of archaeology, and `AI-05` does not stop applying because the claim is
 *   made in geometry rather than prose. A registry entry without complete provenance is
 *   refused by {@link isRenderableReconstruction}, which is the same gate the payload's
 *   own sources pass through.
 *
 * Dependencies
 *   `@atlas/shared` for `SourceAttribution`, React for the component type. Types only —
 *   nothing here renders, so this module stays loadable under the `logic` test project.
 */

import type { SourceAttribution } from '@atlas/shared';
import type { ComponentType } from 'react';

import { isRenderableSource } from './attribution';

/**
 * What a reconstruction renderer is handed.
 *
 * Deliberately no `width` or `height`: the sheet gives the renderer a container with a
 * fixed aspect ratio and the renderer fills it, exactly as `CitySiteMap` does. Passing
 * pixels would make the sheet responsible for measuring a component it has never seen.
 */
export interface CityReconstructionProps {
  /** The gazetteer id of the site being shown. */
  readonly placeId: string;
  /** True when the reader has asked for reduced motion; no camera drift, no auto-orbit. */
  readonly reducedMotion: boolean;
}

/** One available reconstruction. */
export interface CityReconstruction {
  /** Stable asset key. */
  readonly id: string;
  /** The period depicted, e.g. `Roman colony, c. AD 50`. Shown beside the model. */
  readonly eraLabel: string;
  /** Who made it and under what licence. Required — see the module header. */
  readonly attribution: SourceAttribution;
  /** The renderer. Loaded by the rendering layer; the domain only names it. */
  readonly render: ComponentType<CityReconstructionProps>;
}

/** Where the sheet asks whether a site has a model. */
export interface CityReconstructionRegistry {
  /**
   * Look one up.
   *
   * @param placeId - The gazetteer id from the payload's location.
   * @returns The reconstruction, or `null` when none exists for this site.
   */
  readonly lookup: (placeId: string) => CityReconstruction | null;
}

/**
 * Whether a reconstruction may be shown.
 *
 * @param reconstruction - A registry entry.
 * @returns True when it names a renderer, an era, and a complete source.
 *   Side effects: none.
 */
export function isRenderableReconstruction(reconstruction: CityReconstruction): boolean {
  return (
    reconstruction.id.trim().length > 0 &&
    reconstruction.eraLabel.trim().length > 0 &&
    isRenderableSource(reconstruction.attribution)
  );
}

/**
 * The registry M2 ships: empty, on purpose.
 *
 * Every lookup returns `null`, which is the truth. Replacing this with a populated
 * registry is the whole of the work when a model is commissioned.
 */
export const NO_RECONSTRUCTIONS: CityReconstructionRegistry = {
  lookup: () => null,
};

/**
 * Resolve the reconstruction for a site, applying the provenance gate.
 *
 * @param registry - Usually {@link NO_RECONSTRUCTIONS}.
 * @param placeId - The site's gazetteer id.
 * @param hasReconstruction - The server's own flag. Both must agree: a registry entry the
 *   server does not know about is a client-side claim with no server provenance, and
 *   `AI-05` does not allow one.
 * @returns The reconstruction to render, or `null`. Side effects: none.
 */
export function resolveReconstruction(
  registry: CityReconstructionRegistry,
  placeId: string,
  hasReconstruction: boolean,
): CityReconstruction | null {
  if (!hasReconstruction) return null;
  const found = registry.lookup(placeId);
  if (found === null || !isRenderableReconstruction(found)) return null;
  return found;
}
