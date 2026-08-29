/**
 * The spike's fixture passage — Acts 16:11-15, annotated with inline badges.
 *
 * Purpose
 *   A real, wrapping passage to render the badge strategies against, so the spike measures
 *   text flow rather than a one-line demo. `docs/product/mockups/image9.png` uses this exact
 *   passage and shows nine of the ten badge kinds in one screen; Lineage was added afterward
 *   per `Q-018` and is exercised here too, even though the mockup predates it.
 *
 * Translation and copyright
 *   The mockup renders the ESV, which is under copyright. This fixture uses the **World
 *   English Bible** (public domain), so no licensed text enters the repository for the sake
 *   of a layout experiment. Wording therefore differs from the mockup; the annotation
 *   anchors and badge kinds do not.
 *
 * Key responsibilities
 *   - Hold the passage as segments, not as a marked-up string, so no renderer has to parse.
 *   - Expand a verse into word-level segments for the flex-wrap strategy.
 *
 * Dependencies
 *   `@/theme` for `BadgeKind`. No React, no React Native.
 */

import type { BadgeKind } from '@/theme';

/** One run inside a verse. */
export type PassageSegment =
  /** Ordinary scripture. */
  | { readonly type: 'text'; readonly text: string }
  /** The annotated word itself, tinted in its badge's hue (`design-language.md` §5). */
  | { readonly type: 'tinted'; readonly text: string; readonly kind: BadgeKind }
  /** The pill. */
  | { readonly type: 'badge'; readonly kind: BadgeKind };

/** One verse of the fixture. */
export interface PassageVerse {
  /** Verse number, for the gold gutter. */
  readonly number: number;
  /** The verse, in reading order. */
  readonly segments: readonly PassageSegment[];
}

/**
 * Acts 16:11 on its own.
 *
 * Named separately so the spike's size ladder can reference one verse without an index
 * lookup, which `noUncheckedIndexedAccess` would make optional.
 */
export const openingVerse: PassageVerse = {
  number: 11,
  segments: [
    { type: 'text', text: 'Setting sail therefore from ' },
    { type: 'tinted', text: 'Troas', kind: 'route' },
    { type: 'badge', kind: 'route' },
    { type: 'text', text: ', we made a straight course to Samothrace, and the day ' },
    { type: 'text', text: 'following to Neapolis;' },
  ],
};

/**
 * Acts 16:11-15 (World English Bible), annotated.
 *
 * Verse 12 deliberately carries two badges close together and verse 14 places one late in a
 * long verse, so at least one pill lands on a line break at any sensible column width.
 */
export const actsSixteenPassage: readonly PassageVerse[] = [
  openingVerse,
  {
    number: 12,
    segments: [
      { type: 'text', text: 'and from there to ' },
      { type: 'tinted', text: 'Philippi', kind: 'city3d' },
      { type: 'badge', kind: 'city3d' },
      { type: 'text', text: ', which is a city of Macedonia, the foremost of the district, a ' },
      { type: 'tinted', text: 'Roman colony', kind: 'history' },
      { type: 'badge', kind: 'history' },
      { type: 'text', text: '. We were staying some days in this city.' },
      { type: 'badge', kind: 'manuscript' },
    ],
  },
  {
    number: 13,
    segments: [
      {
        type: 'text',
        text: 'On the Sabbath day we went outside of the city by a riverside, where we supposed there was a ',
      },
      { type: 'tinted', text: 'place of prayer', kind: 'crossRef' },
      { type: 'badge', kind: 'crossRef' },
      { type: 'text', text: ', and we sat down and spoke to the women who had come together.' },
      { type: 'badge', kind: 'structure' },
    ],
  },
  {
    number: 14,
    segments: [
      { type: 'text', text: 'A certain woman named Lydia, a seller of ' },
      { type: 'tinted', text: 'purple', kind: 'context' },
      { type: 'badge', kind: 'context' },
      { type: 'text', text: ', of the city of Thyatira, one who ' },
      { type: 'tinted', text: 'worshiped', kind: 'root' },
      { type: 'badge', kind: 'root' },
      {
        type: 'text',
        text: ' God, heard us. The Lord opened her heart to listen to the things which were spoken by Paul.',
      },
    ],
  },
  {
    number: 15,
    segments: [
      { type: 'text', text: 'When she and her ' },
      { type: 'tinted', text: 'household', kind: 'lineage' },
      { type: 'badge', kind: 'lineage' },
      { type: 'text', text: ' were ' },
      { type: 'tinted', text: 'baptized', kind: 'cultural' },
      { type: 'badge', kind: 'cultural' },
      {
        type: 'text',
        text: ', she begged us, saying, "If you have judged me to be faithful to the Lord, come into my house and stay." So she persuaded us.',
      },
      { type: 'badge', kind: 'meditate' },
    ],
  },
];

/** A word-level segment, for the strategy that lays words out as flex children. */
export type PassageWord =
  | { readonly type: 'word'; readonly text: string; readonly kind: BadgeKind | undefined }
  | { readonly type: 'badge'; readonly kind: BadgeKind };

/** Splits on runs of whitespace; empty pieces are dropped by the filter below. */
const WHITESPACE = /\s+/;

/**
 * Expands segments into one entry per word, preserving badges as atoms.
 *
 * The flex-wrap strategy needs this because a wrapping row wraps between CHILDREN: a whole
 * `<Text>` run would be one unbreakable child and the paragraph would flow in blocks.
 *
 * @param segments - A verse's segments.
 * @returns One entry per whitespace-separated word, plus each badge as its own entry.
 */
export function toWords(segments: readonly PassageSegment[]): readonly PassageWord[] {
  return segments.flatMap((segment): readonly PassageWord[] => {
    if (segment.type === 'badge') {
      return [segment];
    }
    const kind = segment.type === 'tinted' ? segment.kind : undefined;
    return segment.text
      .split(WHITESPACE)
      .filter((word) => word.length > 0)
      .map((word) => ({ type: 'word', text: word, kind }) as const);
  });
}

/**
 * The plain reading text of a verse, for `accessibilityLabel`.
 *
 * Any strategy that shatters the verse into many nodes must hand a screen reader the whole
 * sentence back, or the reader hears one word per gesture.
 *
 * @param segments - A verse's segments.
 * @returns The verse with badges removed and whitespace normalised.
 */
export function toPlainText(segments: readonly PassageSegment[]): string {
  return segments
    .filter((segment) => segment.type !== 'badge')
    .map((segment) => segment.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
