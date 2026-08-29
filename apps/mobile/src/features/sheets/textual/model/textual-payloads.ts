/**
 * The three textual badges, as the sheets consume them.
 *
 * Purpose
 *   `[Root]`, `[History]`, `[Cross-Ref]`, `[Lineage]` and `[Manuscript]` are the five badge
 *   kinds `TextualSheet` routes to, whichever `packages/shared` module their payload
 *   actually lives in (`textual-badge.types.ts` for three of them, `historical-badge.types`
 *   for History, `literary-badge.types` for Lineage) — this folder groups by where a badge
 *   renders, not by that split. This module states each payload in the client's
 *   vocabulary — camelCase, `VerseKey` instead of a packed integer — so a sheet component
 *   never touches a wire field and never has to guess whether a value is present.
 *
 * Key responsibilities
 *   - Re-export the two shared payload types that already match the wire exactly, rather
 *     than restating them and letting the two drift.
 *   - Declare the one payload the shared package has NOT caught up with, and say why.
 *   - Name the badge envelope each sheet is handed, so the props of all three sheets are
 *     one generic instead of three hand-written interfaces.
 *
 * Why `RootSheetPayload` is declared here and not imported
 *   `@atlas/shared`'s `RootBadgePayload` predates the lexicon ingest. It asks for
 *   `exampleOsisIds` and `pronunciationAudioUrl`, which no endpoint serves, and it does
 *   not carry `surface`, `verseCount`, `bookCount` or `morphology`, which the endpoint
 *   does serve (`RootPayloadOut` in `schemas.py`). Importing it would mean either
 *   inventing an empty example list at the decode boundary or dropping four real fields.
 *   This type mirrors the endpoint. Reconciling the shared type is a follow-up owned by
 *   whoever owns `packages/shared/src/badges/textual-badge.types.ts`; nothing in this
 *   folder depends on which way that lands.
 *
 * Dependencies
 *   `@atlas/shared` for the envelope, the citation and provenance types, and the two
 *   payloads that are already correct. Pure types — no React, no I/O.
 */

import type {
  ContextBadgePayload,
  CrossRefBadgePayload,
  CulturalBadgePayload,
  HistoryBadgePayload,
  InlineBadgeBase,
  LineageBadgePayload,
  ManuscriptBadgePayload,
  MeditateBadgePayload,
  OriginalLanguage,
  StructureBadgePayload,
  TimelineEvent,
  VerseKeyRange,
} from '@atlas/shared';

export type {
  ContextBadgePayload,
  CrossRefBadgePayload,
  CulturalBadgePayload,
  HistoryBadgePayload,
  LineageBadgePayload,
  ManuscriptBadgePayload,
  MeditateBadgePayload,
  OriginalLanguage,
  StructureBadgePayload,
  TimelineEvent,
};

/**
 * Sheet content for `[Root]` — one original-language word.
 *
 * Mirrors `RootPayloadOut`. Every optional field here is `null`-able on the wire because
 * the lexicons genuinely disagree about what they carry: TBESG has no transliteration for
 * some headwords, and five Strong's numbers minted from TAGNT have no long definition at
 * all (`ASSUMPTIONS.md`, `L-04`).
 */
export interface RootSheetPayload {
  /** The headword in its own script, e.g. `πορφυρόπωλις`. NFC-normalised at ingest. */
  readonly lemma: string;
  /** Which script it is. Decides reading direction — Hebrew and Aramaic are RTL. */
  readonly language: OriginalLanguage;
  /** Latin-script rendering, e.g. `porphuropōlis`. Absent for a few headwords. */
  readonly transliteration?: string;
  /** Strong's number without its language prefix stripped, e.g. `G4211`. */
  readonly strongsNumber: string;
  /** The short gloss, used as the sheet's headline sense. */
  readonly gloss: string;
  /** The word as *this* verse's original text spells it — inflected, often punctuated. */
  readonly surface: string;
  /** How many times the lemma occurs in the corpus that was ingested. */
  readonly occurrenceCount: number;
  /** How many distinct verses contain it. */
  readonly verseCount: number;
  /** How many distinct books contain it. */
  readonly bookCount: number;
  /** The lexicon's fuller definition, when one exists. */
  readonly definition?: string;
  /** Parsing of the surface form, when the word layer supplies it. */
  readonly morphology?: string;
}

/**
 * Sheet content for `[History]`, plus the verse span the dating applies to.
 *
 * `HistoryBadgePayload` in `@atlas/shared` is otherwise an exact match for
 * `HistoryPayloadOut`; only `passage` is missing there, and the sheet uses it to print
 * which verses the date covers rather than implying it covers the whole chapter.
 */
export interface HistorySheetPayload extends HistoryBadgePayload {
  /** The verses this dating covers, both endpoints inclusive. */
  readonly passage?: VerseKeyRange;
}

/** The `[Root]` badge, envelope and all, as a sheet receives it. */
export type RootSheetBadge = InlineBadgeBase<'root', RootSheetPayload>;

/** The `[History]` badge, envelope and all. */
export type HistorySheetBadge = InlineBadgeBase<'history', HistorySheetPayload>;

/** The `[Cross-Ref]` badge, envelope and all. */
export type CrossRefSheetBadge = InlineBadgeBase<'cross-ref', CrossRefBadgePayload>;

/**
 * The `[Lineage]` badge, envelope and all. `LineageBadgePayload` in `@atlas/shared`
 * matches the wire exactly, so unlike `[Root]` it is re-exported rather than restated.
 */
export type LineageSheetBadge = InlineBadgeBase<'lineage', LineageBadgePayload>;

/** The `[Manuscript]` badge, envelope and all. Also re-exported as-is. */
export type ManuscriptSheetBadge = InlineBadgeBase<'manuscript', ManuscriptBadgePayload>;

/** The `[Structure]` badge, envelope and all. Re-exported as-is. */
export type StructureSheetBadge = InlineBadgeBase<'structure', StructureBadgePayload>;

/** The `[Cultural]` badge, envelope and all. Re-exported as-is. */
export type CulturalSheetBadge = InlineBadgeBase<'cultural', CulturalBadgePayload>;

/** The `[Meditate]` badge, envelope and all. Re-exported as-is. */
export type MeditateSheetBadge = InlineBadgeBase<'meditate', MeditateBadgePayload>;

/**
 * The `[Context]` badge, envelope and all. Re-exported as-is.
 *
 * Rendered by `ContextSheet` as a static shell — the payload is drawn, but the sheet does
 * not (yet) call a live grounded-chat endpoint. Live wiring is gated on `M3`'s RAG/pgvector
 * fix, tracked as `m3-rag-pgvector`; wiring `ContextSheet` to a real model ahead of that
 * fix would let an ungrounded answer through with a Grounding Confidence meter that lies.
 */
export type ContextSheetBadge = InlineBadgeBase<'context', ContextBadgePayload>;

/**
 * Any badge this folder knows how to render.
 *
 * Narrow on `kind` before reaching `payload`; `TextualSheet` is the one place that does
 * so, and every sheet below it receives an already-narrowed badge.
 */
export type TextualBadge =
  | RootSheetBadge
  | HistorySheetBadge
  | CrossRefSheetBadge
  | LineageSheetBadge
  | ManuscriptSheetBadge
  | StructureSheetBadge
  | CulturalSheetBadge
  | MeditateSheetBadge
  | ContextSheetBadge;

/** The discriminants this folder answers to. */
export type TextualBadgeKind = TextualBadge['kind'];
