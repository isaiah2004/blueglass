/**
 * Payloads for the three text badges: Root, Manuscript, and Cross-Ref.
 *
 * Purpose
 *   These three are about the words on the page and where they came from — the Word Root
 *   sheet (original-language lemma, Strong's number, pronunciation, Save Flashcard), the
 *   Manuscript sheet (codex photographs beside translation-comparison cards), and the
 *   Cross-Ref sheet (vote-ranked links to related passages).
 *
 * Key responsibilities
 *   - Type a lemma richly enough to become a spaced-repetition flashcard in the Studio
 *     tab without a second fetch.
 *   - Type a textual variant as competing *readings held by named witnesses*, so the
 *     sheet can show disagreement rather than assert one text.
 *
 * Dependencies
 *   `../scripture`, `./badge-envelope.types`. Pure types.
 *
 * Wire compatibility
 *   `CrossReferenceTarget` mirrors the API's cross-reference row
 *   (`flutter-port-map.md` §7, endpoint 2: `ref`, `osis`, `to_start_key`, `to_end_key`,
 *   `votes`, `text`) with the two integer keys already parsed into a `VerseKeyRange` —
 *   the Flutter client dropped them, which is why its cross-reference links could only
 *   ever open the first verse of a span.
 */

import type { VerseKeyRange } from '../scripture';
import type { InlineBadgeBase } from './badge-envelope.types';

/** Which original language a word root comes from. */
export type OriginalLanguage = 'greek' | 'hebrew' | 'aramaic';

/** Sheet content for `[🗣️ Root]` — one original-language word. */
export interface RootBadgePayload {
  /** The word in its own script, e.g. `σέβομαι`. */
  readonly lemma: string;
  /** Which language it is, which decides the script direction and the audio voice. */
  readonly language: OriginalLanguage;
  /** Latin-script rendering, e.g. `sebomai`. */
  readonly transliteration: string;
  /** Strong's concordance number including its language prefix, e.g. `G4576`. */
  readonly strongsNumber: string;
  /** Short definition, as the sheet's headline gloss. */
  readonly gloss: string;
  /** Fuller definition, when the lexicon gives one worth showing. */
  readonly definition?: string;
  /** Pre-rendered native pronunciation. Played by the audio layer, not fetched here. */
  readonly pronunciationAudioUrl?: string;
  /** How many times the lemma occurs in the canon, for the usage stat strip. */
  readonly occurrenceCount?: number;
  /** Other verses using the lemma, as OSIS ids, for the examples list. */
  readonly exampleOsisIds: readonly string[];
}

/** One manuscript's reading of a disputed passage. */
export interface ManuscriptWitness {
  /** Stable identifier within the badge. */
  readonly id: string;
  /** The manuscript's name, e.g. `Codex Sinaiticus`. */
  readonly name: string;
  /** Its date as scholarship gives it, e.g. `4th century`. */
  readonly dateLabel: string;
  /** What this witness actually reads at the disputed point. */
  readonly reading: string;
  /** A high-resolution folio image, when one is licensed for display. */
  readonly imageUrl?: string;
  /** Where the manuscript is held, for the provenance strip in `image8.png`. */
  readonly heldAt?: string;
}

/** How one translation renders the disputed passage. */
export interface TranslationReading {
  /** The translation's short code, e.g. `KJV`, `BSB`. */
  readonly translationCode: string;
  /** Its rendering of the passage. */
  readonly text: string;
}

/** Sheet content for `[📜 Manuscript]` — a textual variant, shown as disagreement. */
export interface ManuscriptBadgePayload {
  /** What is in dispute, in one or two sentences. */
  readonly variantSummary: string;
  /** The manuscripts that carry each reading. At least two, or there is no variant. */
  readonly witnesses: readonly ManuscriptWitness[];
  /** How current translations resolve it, for the comparison cards. */
  readonly translationReadings: readonly TranslationReading[];
}

/** Why two passages are linked. */
export type CrossReferenceRelation = 'quotation' | 'allusion' | 'fulfilment' | 'parallel';

/** One passage this verse points at. */
export interface CrossReferenceTarget {
  /** The verses linked to, both endpoints parsed. */
  readonly range: VerseKeyRange;
  /** The reference as the API prints it, e.g. `1 John 4:9-10`. */
  readonly displayReference: string;
  /** OpenBible community vote count. Higher means a stronger consensus link. */
  readonly votes: number;
  /** Text of the first verse of the span, when the API supplied it. */
  readonly text?: string;
}

/** Sheet content for `[🎯 Cross-Ref]` — vote-ranked links to related scripture. */
export interface CrossRefBadgePayload {
  /** Why this verse is linked outward: a quotation, an allusion, a fulfilment, a parallel. */
  readonly relation: CrossReferenceRelation;
  /** The linked passages, ordered by `votes` descending as the API returns them. */
  readonly targets: readonly CrossReferenceTarget[];
}

/** The `[🗣️ Root]` badge, ready to render. */
export type RootBadge = InlineBadgeBase<'root', RootBadgePayload>;

/** The `[📜 Manuscript]` badge, ready to render. */
export type ManuscriptBadge = InlineBadgeBase<'manuscript', ManuscriptBadgePayload>;

/** The `[🎯 Cross-Ref]` badge, ready to render. */
export type CrossRefBadge = InlineBadgeBase<'cross-ref', CrossRefBadgePayload>;
