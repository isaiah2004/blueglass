/**
 * Rendering Greek, Hebrew and Aramaic correctly.
 *
 * Purpose
 *   The `[Root]` sheet's whole reason to exist is one word in its own script, set large.
 *   Getting that wrong is not a cosmetic failure — a lemma rendered as tofu boxes or laid
 *   out left-to-right is worse than not showing it. This module holds the two decisions
 *   that make it right, as pure functions, so both are pinned by tests rather than by a
 *   screenshot somebody looked at once.
 *
 * Decision 1 — which face
 *   Greek takes the scripture serif. Source Serif 4's shipped faces cover Latin, Greek and
 *   Cyrillic, so `σέβομαι` renders in the same voice as the verse above it and
 *   `design-language.md` §8.4 holds.
 *
 *   Hebrew and Aramaic take **no explicit family**, which hands the platform its own
 *   default face. Source Serif 4 has no Hebrew block at all. Naming it anyway would rely
 *   on per-glyph font fallback, which browsers do and React Native on Android does not do
 *   dependably — the failure mode is a row of empty rectangles on a device while the web
 *   build looks fine, which is precisely the bug that survives a web-only QA pass.
 *   Omitting the family costs one typeface's worth of polish on two scripts that do not
 *   ship data yet, and buys correctness on every target.
 *
 * Decision 2 — which direction
 *   Hebrew and Aramaic are right-to-left. Unicode's bidirectional algorithm handles the
 *   letters themselves everywhere, but not the *alignment* of the block or the placement
 *   of neutral characters — a trailing comma or a bracketed gloss lands on the wrong side
 *   without an explicit direction. So both are set.
 *
 * What is NOT here
 *   Any Hebrew content. The word layer is Greek-only today (`ingest_lexicon.py`: "TAHOT,
 *   the Hebrew word layer, is NOT among the files"), so no `[Root]` badge in the corpus is
 *   Hebrew. This module is still written and tested for it, because the lexicon already
 *   holds 8,674 Hebrew and Aramaic headwords and the day they gain verse occurrences must
 *   not be the day this is discovered to be wrong.
 *
 * Dependencies
 *   `@/theme` for the typography tokens. Pure — no React, no React Native, Node-testable.
 */

import { scriptureText, type ScriptureStep, type ScriptureWeight } from '@/theme';

import type { OriginalLanguage } from '../model/textual-payloads';

/** The two directions a script can be laid out in, as React Native spells them. */
export type ScriptDirection = 'ltr' | 'rtl';

/**
 * A text style for original-language content.
 *
 * Structurally assignable to React Native's `TextStyle`. `fontFamily` is optional and is
 * genuinely absent — not `undefined` — for the right-to-left scripts; see decision 1.
 */
export interface OriginalTextStyle {
  readonly fontFamily?: string;
  readonly fontSize: number;
  readonly fontWeight: '400' | '500' | '600' | '700';
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly writingDirection: ScriptDirection;
  readonly textAlign: 'left' | 'right';
}

/** How each language is named to a reader, and to a screen reader. */
const LANGUAGE_LABEL: Record<OriginalLanguage, string> = {
  greek: 'Greek',
  hebrew: 'Hebrew',
  aramaic: 'Aramaic',
};

/** The scripts written right to left. Greek is not one of them. */
const RIGHT_TO_LEFT: ReadonlySet<OriginalLanguage> = new Set<OriginalLanguage>([
  'hebrew',
  'aramaic',
]);

/**
 * Whether a language is written right to left.
 *
 * @param language - The lemma's language.
 * @returns True for Hebrew and Aramaic. Side effects: none.
 */
export function isRightToLeft(language: OriginalLanguage): boolean {
  return RIGHT_TO_LEFT.has(language);
}

/**
 * The direction a lemma is laid out in.
 *
 * @param language - The lemma's language.
 * @returns `rtl` for Hebrew and Aramaic, `ltr` otherwise. Side effects: none.
 */
export function scriptDirection(language: OriginalLanguage): ScriptDirection {
  return isRightToLeft(language) ? 'rtl' : 'ltr';
}

/**
 * How a language is named in the UI.
 *
 * @param language - The lemma's language.
 * @returns The display name, e.g. `Greek`. Side effects: none.
 */
export function languageLabel(language: OriginalLanguage): string {
  return LANGUAGE_LABEL[language];
}

/**
 * The style original-language text is set in.
 *
 * @param language - The lemma's language, which decides the face and the direction.
 * @param step - A step on the scripture scale. Defaults to `display`, the 32 pt size the
 *   `[Root]` sheet sets its headword at.
 * @param weight - Defaults to `regular`.
 * @returns A style assignable to `TextStyle`. Side effects: none.
 *
 * @example
 * originalTextStyle('hebrew'); // no fontFamily, writingDirection 'rtl', textAlign 'right'
 */
export function originalTextStyle(
  language: OriginalLanguage,
  step: ScriptureStep = 'display',
  weight: ScriptureWeight = 'regular',
): OriginalTextStyle {
  const { fontFamily, ...metrics } = scriptureText(step, weight);
  const direction = scriptDirection(language);
  const layout = {
    ...metrics,
    writingDirection: direction,
    textAlign: direction === 'rtl' ? ('right' as const) : ('left' as const),
  };

  // Spread rather than assigned: `exactOptionalPropertyTypes` makes an explicit
  // `fontFamily: undefined` a type error against an optional property, and it would also
  // reach React Native as a real key.
  return isRightToLeft(language) ? layout : { fontFamily, ...layout };
}

/**
 * The Strong's number as the sheet prints it.
 *
 * The stored value already carries its language prefix (`G4211`, `H0430`), which is what
 * makes it unambiguous — Strong's numbers restart at 1 for Hebrew — so it is printed whole.
 *
 * @param strongsNumber - The number from the payload.
 * @returns The chip's text, e.g. `Strong's G4211`. Side effects: none.
 */
export function strongsLabel(strongsNumber: string): string {
  return `Strong's ${strongsNumber}`;
}

/**
 * What a screen reader is told about a lemma it cannot pronounce.
 *
 * A synthesised voice reading `πορφυρόπωλις` in an English voice produces noise. Naming
 * the language and then the transliteration gives a listener something usable.
 *
 * @param lemma - The headword in its own script.
 * @param language - Its language.
 * @param transliteration - Its Latin-script rendering, when the lexicon has one.
 * @returns The label. Side effects: none.
 */
export function lemmaAccessibilityLabel(
  lemma: string,
  language: OriginalLanguage,
  transliteration?: string,
): string {
  const named = `${languageLabel(language)}: ${lemma}`;

  return transliteration === undefined || transliteration.trim() === ''
    ? named
    : `${named}, transliterated ${transliteration}`;
}
