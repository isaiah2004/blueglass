/**
 * What the `[Root]` sheet says about how often a word is used.
 *
 * Purpose
 *   `image6.png` puts a four-cell statistic strip under the definition — occurrences,
 *   verses, books, share of the corpus. The numbers come straight from the payload; the
 *   *sentences* around them do not, and getting those wrong is how a sheet ends up
 *   claiming more than the data supports. This module owns that wording, as pure
 *   functions, so every claim is pinned by a test.
 *
 * Key responsibilities
 *   - Turn the three counts into stat cells with correct singulars and plurals.
 *   - Name the corpus honestly. A Greek lemma's counts are counts *in the Greek New
 *     Testament*, because that is the word layer that was ingested — not "in the Bible".
 *   - Say what the sheet can and cannot show about other occurrences.
 *
 * The hapax legomenon, and why it is the headline
 *   The badge builder only badges a word occurring twelve times or fewer, and every
 *   `[Root]` badge in the corpus today is a single occurrence — `πορφυρόπωλις`,
 *   `Σαμοθρᾴκη`, `κολωνία`, `βραδυπλοέω`. "This word occurs once in the whole New
 *   Testament" is the most interesting true thing the sheet can say, so it is said in
 *   words and not left for the reader to infer from a `1`.
 *
 * What the sheet cannot do, and admits
 *   `RootPayloadOut` carries counts but no list of the other verses, and no endpoint
 *   serves one. So the examples section shows the verse the reader is standing in and
 *   states the count; it does not print an empty list under a promising heading.
 *
 * Dependencies
 *   The folder's payload types. Pure — no React, no I/O, Node-testable.
 */

import type { OriginalLanguage, RootSheetPayload } from '../model/textual-payloads';

/** One cell of the statistic strip. Structurally the `Stat` that `StatRow` renders. */
export interface UsageStat {
  /** The number, already formatted. */
  readonly value: string;
  /** The uppercase caption beneath it. */
  readonly caption: string;
}

/** What the counted corpus is, per language. Greek is the ingested New Testament. */
const CORPUS_LABEL: Record<OriginalLanguage, string> = {
  greek: 'the Greek New Testament',
  hebrew: 'the Hebrew Bible',
  aramaic: 'the Aramaic portions of the Old Testament',
};

/**
 * The corpus a lemma's counts are counts of.
 *
 * @param language - The lemma's language.
 * @returns The corpus, phrased to drop into a sentence. Side effects: none.
 */
export function corpusLabel(language: OriginalLanguage): string {
  return CORPUS_LABEL[language];
}

/**
 * Pluralise a noun against a count.
 *
 * @param count - How many.
 * @param one - The singular form.
 * @param many - The plural form.
 * @returns The right form. Side effects: none.
 */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * The statistic strip's cells.
 *
 * Three cells, not the mockup's four. The fourth in `image6.png` is a share-of-corpus
 * percentage, which needs a testament split the payload does not carry; inventing one to
 * fill a cell would be a fabricated number sitting beside three real ones.
 *
 * @param payload - The `[Root]` payload.
 * @returns The cells, left to right. Side effects: none.
 */
export function usageStats(payload: RootSheetPayload): readonly UsageStat[] {
  return [
    {
      value: String(payload.occurrenceCount),
      // "Use" rather than "Occurrence": at a phone's width the strip gives each caption
      // about 90 dp, and 9 pt tracked at 0.16 em breaks "Occurrences" mid-word. The precise
      // term is not lost — `rarityNote` says "occurs" in the sentence directly below.
      caption: plural(payload.occurrenceCount, 'Use', 'Uses'),
    },
    { value: String(payload.verseCount), caption: plural(payload.verseCount, 'Verse', 'Verses') },
    { value: String(payload.bookCount), caption: plural(payload.bookCount, 'Book', 'Books') },
  ];
}

/**
 * Whether a lemma occurs exactly once in the corpus.
 *
 * @param payload - The `[Root]` payload.
 * @returns True for a hapax legomenon. Side effects: none.
 */
export function isSingleOccurrence(payload: RootSheetPayload): boolean {
  return payload.occurrenceCount === 1;
}

/**
 * The sentence under the statistic strip.
 *
 * @param payload - The `[Root]` payload.
 * @returns One sentence stating how rare the word is. Side effects: none.
 *
 * @example
 * rarityNote(payload); // 'This word occurs once in the whole of the Greek New Testament.'
 */
export function rarityNote(payload: RootSheetPayload): string {
  const corpus = corpusLabel(payload.language);
  if (isSingleOccurrence(payload)) {
    return `This word occurs once in the whole of ${corpus}.`;
  }

  const books = `${String(payload.bookCount)} ${plural(payload.bookCount, 'book', 'books')}`;
  const verses = `${String(payload.verseCount)} ${plural(payload.verseCount, 'verse', 'verses')}`;

  return `It occurs ${String(payload.occurrenceCount)} times in ${corpus}, across ${verses} in ${books}.`;
}

/**
 * The caption over the example-verse section.
 *
 * @param payload - The `[Root]` payload.
 * @returns A caption that describes exactly what is listed below it — one verse — without
 *   implying a list that is not served. Side effects: none.
 */
export function examplesCaption(payload: RootSheetPayload): string {
  if (payload.verseCount <= 1) {
    return 'The verse you are reading is its only occurrence.';
  }

  const others = payload.verseCount - 1;

  return `The verse you are reading, and ${String(others)} other ${plural(others, 'verse', 'verses')}.`;
}

/**
 * The line under the sheet's headline, when it adds anything.
 *
 * The alignment matched the English word to the lemma *by its gloss*, so for most badges the
 * gloss and the word the reader tapped are the same string — "dealer in purple" set twice,
 * three lines apart, reads as a rendering fault rather than as a definition.
 *
 * @param payload - The `[Root]` payload.
 * @param anchorText - The English word the badge is attached to.
 * @returns The gloss, or `undefined` when it merely repeats the headline. Side effects: none.
 */
export function headlineSummary(payload: RootSheetPayload, anchorText: string): string | undefined {
  const gloss = payload.gloss.trim();

  return gloss.toLowerCase() === anchorText.trim().toLowerCase() ? undefined : gloss;
}
