/**
 * Citations — the evidence attached to anything the app asserts.
 *
 * Purpose
 *   Product pillar 3 is zero-hallucination AI: "every claim carries a citation, or it is
 *   not rendered" (CLAUDE.md). That is only enforceable if a citation is a required part
 *   of the data model rather than a rendering afterthought, so every badge payload and
 *   every AI answer carries `readonly citations: readonly Citation[]`.
 *
 * Key responsibilities
 *   - Type the source chip the design language requires beside every claim.
 *   - Type the grounding-confidence signal the Studio sheet displays (`image11.png`).
 *
 * Dependencies
 *   None. Pure types.
 *
 * Note
 *   A citation is deliberately *not* a URL-only shape. Manuscript and gazetteer sources
 *   often have no public link, and a chip with no label is unrenderable — so `label` is
 *   required and `url` is not.
 */

/** What kind of source a citation points at. Drives the chip's icon and colour. */
export type CitationKind =
  /** Another passage of scripture. `osis` is populated. */
  | 'scripture'
  /** A lexicon, concordance, atlas, or commentary. */
  | 'reference-work'
  /** A codex, papyrus, or critical apparatus. */
  | 'manuscript'
  /** A place-name authority such as Pleiades or OpenBible.info. */
  | 'gazetteer'
  /** Anything else, including an editorially reviewed web source. */
  | 'external';

/** One piece of evidence, renderable as the source chip beside a claim. */
export interface Citation {
  /** Stable identifier, unique within the record that carries it. */
  readonly id: string;
  /** What the source is, so the chip can be styled and grouped. */
  readonly kind: CitationKind;
  /** What the chip prints, e.g. `Acts 16:14` or `Codex Sinaiticus, f. 244`. */
  readonly label: string;
  /** OSIS id of the cited verse. Present when `kind` is `scripture`. */
  readonly osis?: string;
  /** Name of the work or dataset, e.g. `Strong's Concordance`, `Pleiades`. */
  readonly sourceName?: string;
  /** Public link, when one exists. Many manuscript sources have none. */
  readonly url?: string;
}

/**
 * Provenance for one dataset a claim rests on.
 *
 * Added for M2. Decision `AI-05` requires every badge to **name** its source and licence,
 * not merely to carry a citation chip: a chip proves someone said this, a licence proves
 * we may repeat it, and `docs/decisions/DECISIONS.md` `Q-007` turns on being able to tell
 * a share-alike source from a permissive one by inspection rather than by reading prose.
 *
 * `license` is spelled the American way because that is the database column and the wire
 * field; renaming a published field for a spelling preference is not worth a migration.
 */
export interface SourceAttribution {
  /** Stable key in the provenance table, e.g. `openbible_geocoding`. */
  readonly key: string;
  /** Human name of the dataset. */
  readonly name: string;
  /** SPDX-style identifier, e.g. `CC-BY-4.0`. */
  readonly license: string;
  /** The line the licence obliges us to print, verbatim. */
  readonly attribution: string;
  /** True when the licence is copyleft, which constrains redistribution (`Q-007`). */
  readonly shareAlike: boolean;
  /** Where the dataset lives, when it has a public home. */
  readonly url?: string;
  /** The dataset's own version or release date. */
  readonly version?: string;
  /** ISO date we fetched it. A 2021 gazetteer and a 2026 dump are not equally fresh. */
  readonly retrievedAt?: string;
}

/**
 * How well grounded a generated claim is.
 *
 * The Studio sheet renders this as the Grounding Confidence meter, and the design
 * language requires that `low` says so out loud rather than being hidden.
 */
export type GroundingConfidence = 'high' | 'medium' | 'low';
