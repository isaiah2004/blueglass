/**
 * The pre-computed passage record — the app's offline-first content unit.
 *
 * Purpose
 *   `docs/product/prd.md` §11 defines a Pre-computed Data Pipeline: every passage's
 *   multimodal layers are generated once during the editorial build and shipped as JSON,
 *   "to ensure fast load times and eliminate real-time AI rendering costs". These types
 *   are that JSON's shape, as the domain sees it after parsing.
 *
 * Key responsibilities
 *   - Mirror the three data blocks the spec names: spatial, temporal, structural.
 *   - Carry the inline badges the reader renders, so one fetch powers the whole chapter.
 *
 * Dependencies
 *   `../badges`, `../geo`, `./passage-id`. Pure types.
 *
 * Casing
 *   The wire format is `snake_case` (`spatial_data`, `has_3d_reconstruction`); these
 *   types are `camelCase`. Translating between them is the API adapter's job, not the
 *   domain's — the domain must not be shaped by a transport convention.
 *
 * Why the three blocks are optional
 *   The spec's worked example is a sea voyage and has all three. A Psalm has no journey
 *   and no emperor. Modelling them as required would force the pipeline to emit empty
 *   objects, and an empty `spatial_data` is indistinguishable from a pipeline failure.
 */

import type { InlineBadge } from '../badges';
import type { MapCamera, MappedLocation } from '../geo';
import type { PassageId } from './passage-id';

/** `spatial_data` — where the passage happens. */
export interface PassageSpatialData {
  /** Where the map camera opens, framing every location below. */
  readonly camera: MapCamera;
  /** The places named in the passage, in narrative order. */
  readonly locations: readonly MappedLocation[];
}

/** `temporal_data` — when the passage happens, and under whom. */
export interface PassageTemporalData {
  /** The date as the sources express it, e.g. `50 AD`. Never a bare integer. */
  readonly yearApproximate: string;
  /** Who ruled, when a source names them, e.g. `Claudius`. */
  readonly rulerName?: string;
  /** One paragraph of background the reader needs, quoted from the editorial pipeline. */
  readonly culturalContextNote: string;
}

/** `structural_data` — the literary shape of the passage. */
export interface PassageStructuralData {
  /** The form, e.g. `Historical Narrative`. */
  readonly literaryType: string;
  /**
   * The chiastic outline as authored, e.g. `A: Vision at Troas`, `A': Conversion of
   * Lydia`. Strings here because this is the pipeline's summary; the Structure badge
   * carries the same material as a graph with explicit mirror edges.
   */
  readonly keyChiasticNodes: readonly string[];
}

/**
 * One pre-computed passage, complete.
 *
 * This is what a reading-plan day loads, what the offline cache stores, and what the
 * Discover tab cross-links into. Everything the reader can see about a passage without
 * a network call is reachable from here.
 */
export interface PassageEnrichment {
  /** The record's identity, e.g. `ACTS_16_11_15`. */
  readonly id: PassageId;
  /** Where the passage happens. Absent for passages with no geography. */
  readonly spatial?: PassageSpatialData;
  /** When it happens. Absent for passages with no datable setting. */
  readonly temporal?: PassageTemporalData;
  /** Its literary shape. Absent when the pipeline found no structure worth showing. */
  readonly structural?: PassageStructuralData;
  /**
   * The inline badges to render in this passage's verses, in reading order. Empty is
   * valid and means "pre-computed, nothing to annotate" — which is different from the
   * record being missing altogether.
   */
  readonly badges: readonly InlineBadge[];
}
