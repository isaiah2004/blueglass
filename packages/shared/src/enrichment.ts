/**
 * The pre-computed enrichment domain's public surface.
 *
 * Purpose
 *   One import for everything about the pre-computed passage record defined in
 *   `docs/product/prd.md` §11 — its identifier and its three data blocks. Consumers
 *   import from here (or from `@atlas/shared`) and never reach into `enrichment/*`
 *   directly (rule 5.3.3).
 *
 * Dependencies
 *   Only its own folder. Zero infrastructure imports: this describes the *shape* of a
 *   record, never how it is fetched, cached, or stored.
 */

export type {
  PassageEnrichment,
  PassageSpatialData,
  PassageStructuralData,
  PassageTemporalData,
} from './enrichment/passage-record.types';

export type { PassageId } from './enrichment/passage-id';
export { formatPassageId, parsePassageId } from './enrichment/passage-id';
