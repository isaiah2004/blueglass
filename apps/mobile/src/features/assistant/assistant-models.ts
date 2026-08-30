/**
 * The Studio Assistant's client-side vocabulary.
 *
 * Purpose
 *   `POST /assistant/ask` (`app/modules/assistant/presentation/schemas.py`) answers with
 *   an `answer`, a `citations` list, and a `confidence` grade. This module states that
 *   shape in the client's own naming — camelCase, `GroundingConfidence` reused from
 *   `@atlas/shared` rather than restated — the same split every other endpoint in this
 *   folder structure follows (see `badge-models.ts`).
 *
 * Why a citation here is not `@atlas/shared`'s `Citation`
 *   That type carries `kind`/`sourceName`/`url` fields no ingested-passage retrieval
 *   result can honestly fill in yet (there is one kind of source today: a scripture
 *   chunk), and it has no `score`, which is the one number the sheet's low-confidence
 *   reasoning actually wants to show. Forcing the fit would mean inventing values this
 *   endpoint does not have an opinion on. `AssistantCitation` is the wire shape as it
 *   really is; reconciling with the shared `Citation` is a follow-up once a second
 *   citation kind (e.g. dictionary entries) actually exists.
 *
 * Dependencies
 *   `@atlas/shared` for `GroundingConfidence` only.
 */

import type { GroundingConfidence } from '@atlas/shared';

export type { GroundingConfidence };

/** One source the answer was grounded in. */
export interface AssistantCitation {
  /** Human-readable reference, e.g. `Acts 16:14`. */
  readonly label: string;
  /** The verse this citation points at, when the chunk resolves to exactly one. */
  readonly verseKey: number | null;
  /** Relevance in `[0, 1]`; higher is more relevant. */
  readonly score: number;
}

/** A grounded answer to one question. */
export interface AssistantAnswer {
  readonly answer: string;
  readonly citations: readonly AssistantCitation[];
  readonly confidence: GroundingConfidence;
}
