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
 * How well grounded a generated claim is.
 *
 * The Studio sheet renders this as the Grounding Confidence meter, and the design
 * language requires that `low` says so out loud rather than being hidden.
 */
export type GroundingConfidence = 'high' | 'medium' | 'low';
